import { getCurrentScope, onScopeDispose, ref, watch, type Ref } from 'vue';
import { useInvestWidgetProviders } from '../providers.ts';

export interface UploaderWithIdsProps {
  modelValue?: number[] | null;
  isError?: boolean;
  isDisabled?: boolean;
  isLoading?: boolean;
  maxFiles?: number;
  maxFileSize?: number; // in MB
  acceptedFileTypes?: string; // e.g., "application/pdf,image/*"
  dragDropText?: string;
  uploadButtonText?: string;
  supportedFilesText?: string;
  maxSizeText?: string;
  showFilePreview?: boolean;
  showSupportedFilesInfo?: boolean;
  showMaxSizeInfo?: boolean;
  customClass?: string;
  multiple?: boolean | null;
}

// Keep emit flexible to be compatible with Vue's generated emit type
export type UploaderWithIdsEmit = any;

export interface UseUploaderWithIdsReturn {
  filesUploadError: Ref<string>;
  isUploading: Ref<boolean>;
  uploadedFileIds: Ref<number[]>;
  uploadedFileNames: Ref<string[]>;
  uploadedFiles: Ref<File[]>;
  onFilesChange: (files: File[]) => Promise<void>;
  onFileRemove: (index: number) => void;
  onUploaderError: (message: string) => void;
  onClick: (index: number) => void;
}

export function useUploaderWithIds(
  props: Readonly<UploaderWithIdsProps>,
  emit: UploaderWithIdsEmit
): UseUploaderWithIdsReturn {
  const filesUploadError = ref('');
  const isUploading = ref(false);
  const uploadedFileIds = ref<number[]>(props.modelValue || []);
  const uploadedFileNames = ref<string[]>([]);
  const uploadedFiles = ref<File[]>([]);

  const filerProvider = useInvestWidgetProviders().filer;
  let uploadController: AbortController | null = null;

  watch(
    () => props.modelValue,
    (newValue) => {
      uploadedFileIds.value = newValue || [];
    }
  );

  watch(isUploading, (newValue) => {
    emit('uploading', newValue);
  });

  const onUpload = async (file: File): Promise<number | null> => {
    const userId = filerProvider.getCurrentUserId();
    if (!Number.isSafeInteger(userId) || Number(userId) <= 0) {
      throw new Error('User id is required to upload files');
    }

    uploadController ??= new AbortController();
    const result = await filerProvider.uploadFile(file, {
      objectId: userId as number,
      objectName: 'user',
      userId: userId as number,
      signal: uploadController.signal,
    });
    return result.fileId;
  };

  const onFilesChange = async (files: File[]) => {
    if (files.length === 0) {
      uploadedFileIds.value = [];
      uploadedFileNames.value = [];
      uploadedFiles.value = [];
      emit('update:modelValue', null);
      emit('upload-success', []);
      return;
    }

    isUploading.value = true;
    filesUploadError.value = '';

    try {
      const newFileIds: number[] = [];
      const newFileNames: string[] = [];
      const newFiles: File[] = [];

      const filesToProcess = props.multiple === null ? [files[files.length - 1]] : files;

      for (const file of filesToProcess) {
        const uploadedFileId = await onUpload(file);
        if (uploadedFileId) {
          newFileIds.push(uploadedFileId);
          newFileNames.push(file.name);
          newFiles.push(file);
        } else {
          throw new Error(`Failed to upload file: ${file.name}`);
        }
      }

      uploadedFileIds.value = newFileIds;
      uploadedFileNames.value = newFileNames;
      uploadedFiles.value = newFiles;

      emit('update:modelValue', uploadedFileIds.value);
      emit('upload-success', uploadedFileIds.value);
      filesUploadError.value = '';
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed. Please try again.';
      filesUploadError.value = errorMessage;
      filerProvider.reportError(error, 'Failed to upload files');
      emit('upload-error', errorMessage);
    } finally {
      isUploading.value = false;
      uploadController = null;
    }
  };

  const onFileRemove = (index: number) => {
    uploadedFileIds.value.splice(index, 1);
    uploadedFileNames.value.splice(index, 1);
    uploadedFiles.value.splice(index, 1);

    emit('update:modelValue', uploadedFileIds.value.length > 0 ? uploadedFileIds.value : null);
    emit('remove', index);
  };

  const onUploaderError = (message: string) => {
    filesUploadError.value = message;
    emit('upload-error', message);
  };

  const onClick = (index: number) => {
    if (uploadedFileIds.value[index] && uploadedFileIds.value[index] > 0) {
      const filerUrl = filerProvider.getFilerUrl();
      const fileUrl = `${filerUrl}/auth/files/${uploadedFileIds.value[index]}`;
      window.open(fileUrl, '_blank');
    }
  };

  if (getCurrentScope()) {
    onScopeDispose(() => uploadController?.abort());
  }

  return {
    filesUploadError,
    isUploading,
    uploadedFileIds,
    uploadedFileNames,
    uploadedFiles,
    onFilesChange,
    onFileRemove,
    onUploaderError,
    onClick,
  };
}
