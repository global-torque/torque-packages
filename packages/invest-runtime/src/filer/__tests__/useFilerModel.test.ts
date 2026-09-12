import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { FilerObjectTree } from '@webdevelop-pro/domain-types/filerTypes';
import { useFilerModel } from '../useFilerModel.ts';

const mocks = vi.hoisted(() => ({
  fetchObjectTree: vi.fn(),
  uploadFilerFile: vi.fn(),
}));

vi.mock('@webdevelop-pro/invest-data/filer', () => ({
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

  it('invalidates cached object trees when a filer object notification arrives', async () => {
    mocks.fetchObjectTree.mockResolvedValue(tree(1));
    const repository = useFilerModel();
    await repository.fetchObjectTree({ access: 'private', objectName: 'investment', objectId: 101 });
    const initialVersion = repository.objectInvalidationVersion;

    repository.updateNotificationData({ data: { fields: { object_id: 1, type: 'file_thumbnail' } } });

    expect(repository.getObjectQueryState('private', 'investment', 101).data).toBeUndefined();
    expect(repository.objectInvalidationVersion).toBe(initialVersion + 1);
  });

  it('does not let an in-flight response repopulate a notification-invalidated query', async () => {
    let resolveRequest!: (value: FilerObjectTree) => void;
    mocks.fetchObjectTree.mockImplementation(() => new Promise(resolve => { resolveRequest = resolve; }));
    const repository = useFilerModel();
    const request = repository.fetchObjectTree({
      access: 'private', objectName: 'investment', objectId: 101, force: true,
    });
    repository.updateNotificationData({ data: { fields: { object_id: 1, type: 'file_thumbnail' } } });
    resolveRequest(tree(1));
    await request;

    expect(repository.getObjectQueryState('private', 'investment', 101).data).toBeUndefined();
  });

});
