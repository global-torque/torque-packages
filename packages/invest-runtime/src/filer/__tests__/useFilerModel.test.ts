import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { FilerObjectTree } from '@global-torque/domain-types/filerTypes';
import { useFilerModel } from '../useFilerModel.ts';

const mocks = vi.hoisted(() => ({
  fetchMyObjectTree: vi.fn(),
  fetchObjectTree: vi.fn(),
  uploadFilerFile: vi.fn(),
}));

vi.mock('@global-torque/invest-data/filer', () => ({
  fetchMyObjectTree: mocks.fetchMyObjectTree,
  fetchObjectTree: mocks.fetchObjectTree,
  uploadFilerFile: mocks.uploadFilerFile,
  parseFilerNotificationFields: (value: unknown) => (
    value && typeof value === 'object' && 'data' in value
      ? (value as { data: { fields: Record<string, unknown> } }).data.fields
      : null
  ),
}));

const tree = (id: number): FilerObjectTree => ({
  entities: { [id]: { id, filename: `${id}.pdf` } },
});

describe('filer repository', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mocks.fetchMyObjectTree.mockReset();
    mocks.fetchObjectTree.mockReset();
  });

  it('keeps concurrent object results isolated by request key', async () => {
    mocks.fetchObjectTree.mockImplementation(async ({ objectId }: { objectId: number }) => tree(objectId));
    const repository = useFilerModel();
    const [investmentA, investmentB] = await Promise.all([
      repository.fetchObjectTree({ access: 'private', objectName: 'investment', objectId: 101 }),
      repository.fetchObjectTree({ access: 'private', objectName: 'investment', objectId: 202 }),
    ]);

    expect(investmentA).toEqual(tree(101));
    expect(investmentB).toEqual(tree(202));
    expect(repository.getObjectQueryState('private', 'investment', 101).data).toEqual(tree(101));
    expect(repository.getObjectQueryState('private', 'investment', 202).data).toEqual(tree(202));
  });

  it('does not let an older forced response overwrite a newer response', async () => {
    let resolveOld!: (value: FilerObjectTree) => void;
    let resolveNew!: (value: FilerObjectTree) => void;
    mocks.fetchObjectTree
      .mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
      .mockImplementationOnce(() => new Promise(resolve => { resolveNew = resolve; }));
    const repository = useFilerModel();
    const oldRequest = repository.fetchObjectTree({
      access: 'private', objectName: 'investment', objectId: 101, force: true,
    });
    const newRequest = repository.fetchObjectTree({
      access: 'private', objectName: 'investment', objectId: 101, force: true,
    });

    resolveNew(tree(2));
    await newRequest;
    resolveOld(tree(1));
    await oldRequest;
    expect(repository.getObjectQueryState('private', 'investment', 101).data).toEqual(tree(2));
  });

  it('keeps cached filer trees intact when a notification has only identifiers', async () => {
    mocks.fetchObjectTree.mockResolvedValue(tree(1));
    mocks.fetchMyObjectTree.mockResolvedValue(tree(2));
    const repository = useFilerModel();
    await repository.fetchObjectTree({ access: 'private', objectName: 'investment', objectId: 101 });
    await repository.fetchMyObjectTree();
    const initialVersion = repository.objectInvalidationVersion;
    const initialMyTreeVersion = repository.myObjectInvalidationVersion;
    mocks.fetchObjectTree.mockClear();
    mocks.fetchMyObjectTree.mockClear();

    repository.updateNotificationData({
      data: { fields: { object_id: 101, source_file_id: 1, type: 'file_thumbnail' } },
    });

    expect(repository.notificationFieldsState.data).toEqual({
      object_id: 101,
      source_file_id: 1,
      type: 'file_thumbnail',
    });
    expect(repository.getObjectQueryState('private', 'investment', 101).data).toEqual(tree(1));
    expect(repository.myObjectTreeState.data).toEqual(tree(2));
    expect(repository.objectInvalidationVersion).toBe(initialVersion);
    expect(repository.myObjectInvalidationVersion).toBe(initialMyTreeVersion);
    expect(mocks.fetchObjectTree).not.toHaveBeenCalled();
    expect(mocks.fetchMyObjectTree).not.toHaveBeenCalled();
  });

  it('invalidates cached object trees only through the explicit invalidation action', async () => {
    mocks.fetchObjectTree.mockResolvedValue(tree(1));
    const repository = useFilerModel();
    await repository.fetchObjectTree({ access: 'private', objectName: 'investment', objectId: 101 });
    const initialVersion = repository.objectInvalidationVersion;

    repository.invalidateObjectTree('private', 'investment', 101);

    expect(repository.getObjectQueryState('private', 'investment', 101).data).toBeUndefined();
    expect(repository.objectInvalidationVersion).toBe(initialVersion + 1);
  });

  it('caches an empty authenticated account tree and refreshes it only when forced', async () => {
    mocks.fetchMyObjectTree.mockResolvedValue({ entities: {} });
    const repository = useFilerModel();

    await repository.fetchMyObjectTree();
    await repository.fetchMyObjectTree();
    await repository.fetchMyObjectTree({ force: true });

    expect(mocks.fetchMyObjectTree).toHaveBeenCalledTimes(2);
    expect(repository.myObjectTreeState.data).toEqual({ entities: {} });
    expect(repository.isMyObjectTreeCacheValid).toBe(true);
  });

  it('retains account data through a failed refresh', async () => {
    const repository = useFilerModel();
    mocks.fetchMyObjectTree.mockResolvedValueOnce(tree(1));
    await repository.fetchMyObjectTree();

    mocks.fetchMyObjectTree.mockRejectedValueOnce(new Error('refresh failed'));
    await expect(repository.fetchMyObjectTree({ force: true })).rejects.toThrow('refresh failed');
    expect(repository.myObjectTreeState.data).toEqual(tree(1));
    expect(repository.isMyObjectTreeCacheValid).toBe(false);
    expect(repository.myObjectTreeState.error?.message).toBe('refresh failed');
  });

  it('resets profile-keyed trees without clearing the authenticated account cache', async () => {
    mocks.fetchObjectTree.mockResolvedValue(tree(101));
    mocks.fetchMyObjectTree.mockResolvedValue(tree(1));
    const repository = useFilerModel();
    await repository.fetchObjectTree({ access: 'private', objectName: 'investment', objectId: 101 });
    await repository.fetchMyObjectTree();

    repository.resetObjectQueries();

    expect(repository.getObjectQueryState('private', 'investment', 101).data).toBeUndefined();
    expect(repository.myObjectTreeState.data).toEqual(tree(1));
    expect(repository.isMyObjectTreeCacheValid).toBe(true);
  });

  it('does not let reset or stale account responses write state', async () => {
    let resolveOld!: (value: FilerObjectTree) => void;
    mocks.fetchMyObjectTree.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
    const repository = useFilerModel();
    const request = repository.fetchMyObjectTree({ force: true });

    repository.resetAll();
    resolveOld(tree(1));
    await request;

    expect(repository.myObjectTreeState.data).toBeUndefined();
    expect(repository.isMyObjectTreeCacheValid).toBe(false);
  });

  it('rejects aborted account requests without creating a visible repository error', async () => {
    const abortError = new DOMException('The request was aborted.', 'AbortError');
    mocks.fetchMyObjectTree.mockRejectedValueOnce(abortError);
    const repository = useFilerModel();

    await expect(repository.fetchMyObjectTree({ signal: new AbortController().signal })).rejects.toBe(abortError);

    expect(repository.myObjectTreeState.error).toBeNull();
  });

});
