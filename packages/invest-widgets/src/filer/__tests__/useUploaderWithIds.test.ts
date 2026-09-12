import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { reactive } from 'vue';
import {
  resetInvestWidgetProvidersForTests,
  setInvestWidgetProviders,
} from '../../providers.ts';

const mockUploadFile = vi.fn(async () => ({ fileId: 1 }));
const reportError = vi.fn();

import { useUploaderWithIds } from '../useUploaderWithIds.ts';

const createFiles = () => {
  const file1 = new File([new Uint8Array([1, 2, 3])], 'doc1.png', { type: 'image/png' });
  const file2 = new File([new Uint8Array([4, 5, 6])], 'doc2.png', { type: 'image/png' });
  return { file1, file2 };
};

describe('useUploaderWithIds', () => {
  beforeEach(() => {
    mockUploadFile.mockReset();
    reportError.mockReset();
    setInvestWidgetProviders({
      filer: {
        getCurrentUserId: () => 123,
        getFilerUrl: () => 'https://files.example.com',
        uploadFile: mockUploadFile,
        reportError,
      },
    });
  });

  afterEach(() => {
    resetInvestWidgetProvidersForTests();
  });

  it('emits update and success with last file only when multiple is null', async () => {
    const emit = vi.fn();
    const props = reactive({
      modelValue: null as number[] | null,
      multiple: null as boolean | null,
    });
    const uploader = useUploaderWithIds(props, emit);

    const { file1, file2 } = createFiles();

    const nextId = 11;
    mockUploadFile.mockResolvedValue({ fileId: nextId });

    await uploader.onFilesChange([file1, file2]);

    expect(mockUploadFile).toHaveBeenCalledTimes(1);
    expect(uploader.uploadedFileIds.value).toEqual([11]);
    expect(uploader.uploadedFileNames.value).toEqual(['doc2.png']);
    expect(uploader.uploadedFiles.value.map(f => f.name)).toEqual(['doc2.png']);

    expect(emit).toHaveBeenCalledWith('update:modelValue', [11]);
    expect(emit).toHaveBeenCalledWith('upload-success', [11]);
  });

  it('processes all files when multiple is true', async () => {
    const emit = vi.fn();
    const props = reactive({
      modelValue: null as number[] | null,
      multiple: true,
    });
    const uploader = useUploaderWithIds(props, emit);

    const { file1, file2 } = createFiles();

    const ids = [21, 22];
    mockUploadFile.mockImplementation(async () => ({ fileId: ids.shift() as number }));

    await uploader.onFilesChange([file1, file2]);

    expect(mockUploadFile).toHaveBeenCalledTimes(2);
    expect(uploader.uploadedFileIds.value).toEqual([21, 22]);
    expect(uploader.uploadedFileNames.value).toEqual(['doc1.png', 'doc2.png']);
    expect(emit).toHaveBeenCalledWith('update:modelValue', [21, 22]);
    expect(emit).toHaveBeenCalledWith('upload-success', [21, 22]);
  });

  it('resets state and emits when files array is empty', async () => {
    const emit = vi.fn();
    const props = reactive({
      modelValue: [100],
      multiple: true,
    });
    const uploader = useUploaderWithIds(props, emit);

    await uploader.onFilesChange([]);

    expect(uploader.uploadedFileIds.value).toEqual([]);
    expect(uploader.uploadedFileNames.value).toEqual([]);
    expect(uploader.uploadedFiles.value).toEqual([]);
    expect(emit).toHaveBeenCalledWith('update:modelValue', null);
    expect(emit).toHaveBeenCalledWith('upload-success', []);
  });

  it('handles upload failure and emits error', async () => {
    const emit = vi.fn();
    const props = reactive({
      modelValue: null as number[] | null,
      multiple: true,
    });
    const uploader = useUploaderWithIds(props, emit);
    const { file1 } = createFiles();

    mockUploadFile.mockRejectedValue(new Error('Failed to upload file'));

    await uploader.onFilesChange([file1]);

    expect(uploader.isUploading.value).toBe(false);
    expect(uploader.filesUploadError.value.length).toBeGreaterThan(0);
    expect(emit).toHaveBeenCalledWith('upload-error', expect.stringContaining('Failed to upload file'));
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), 'Failed to upload files');
  });

  it('removes file by index and emits', async () => {
    const emit = vi.fn();
    const props = reactive({
      modelValue: null as number[] | null,
      multiple: true,
    });
    const uploader = useUploaderWithIds(props, emit);
    const { file1, file2 } = createFiles();

    const ids2 = [31, 32];
    mockUploadFile.mockImplementation(async () => ({ fileId: ids2.shift() as number }));

    await uploader.onFilesChange([file1, file2]);
    uploader.onFileRemove(0);

    expect(uploader.uploadedFileIds.value).toEqual([32]);
    expect(uploader.uploadedFileNames.value).toEqual(['doc2.png']);
    expect(uploader.uploadedFiles.value.map(f => f.name)).toEqual(['doc2.png']);
    expect(emit).toHaveBeenCalledWith('remove', 0);
    expect(emit).toHaveBeenCalledWith('update:modelValue', [32]);

    // remove last
    uploader.onFileRemove(0);
    expect(uploader.uploadedFileIds.value).toEqual([]);
    expect(emit).toHaveBeenCalledWith('update:modelValue', null);
  });

  it('emits uploading status changes', async () => {
    const emit = vi.fn();
    const props = reactive({
      modelValue: null as number[] | null,
      multiple: true,
    });
    const uploader = useUploaderWithIds(props, emit);
    const { file1 } = createFiles();

    mockUploadFile.mockResolvedValueOnce({ fileId: 41 });

    await uploader.onFilesChange([file1]);

    // Expect both true and false emitted at some point
    expect(emit).toHaveBeenCalledWith('uploading', true);
    expect(emit).toHaveBeenCalledWith('uploading', false);
  });

  it('opens file by id on click', () => {
    const emit = vi.fn();
    const props = reactive({
      modelValue: [55],
      multiple: true,
    });
    const uploader = useUploaderWithIds(props, emit);

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null as any);
    uploader.onClick(0);
    expect(openSpy).toHaveBeenCalledWith('https://files.example.com/auth/files/55', '_blank');
    openSpy.mockRestore();
  });
});
