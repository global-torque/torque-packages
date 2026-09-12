<!-- eslint-disable vuejs-accessibility/click-events-have-key-events -->
<script setup lang="ts">
import VUploader from '@global-torque/ui-kit/file-uploader';
import { useUploaderWithIds, type UploaderWithIdsProps } from './useUploaderWithIds.ts';

type Props = UploaderWithIdsProps;

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  isError: false,
  isDisabled: false,
  isLoading: false,
  maxFiles: 5,
  maxFileSize: 10, // 10MB default
  acceptedFileTypes: 'application/pdf,image/jpeg,image/jpg,image/png',
  dragDropText: 'Drag & drop files here or click to upload',
  uploadButtonText: 'Upload',
  supportedFilesText: 'PDF, JPG, JPEG, PNG',
  maxSizeText: 'Maximum size 10MB',
  showFilePreview: true,
  showSupportedFilesInfo: true,
  showMaxSizeInfo: true,
  customClass: '',
  multiple: null,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: number[] | null): void;
  (e: 'upload-success', fileIds: number[]): void;
  (e: 'upload-error', error: string): void;
  (e: 'remove', index: number): void;
  (e: 'uploading', isUploading: boolean): void;
}>();

const {
  filesUploadError,
  isUploading,
  onFilesChange,
  onFileRemove,
  onUploaderError,
  onClick,
} = useUploaderWithIds(props, emit);
</script>

<template>
  <div class="VUploaderWithIds v-uploader-with-ids">
    <VUploader
      :is-error="isError || (filesUploadError.length > 0)"
      :is-disabled="isDisabled || isUploading || isLoading"
      :is-loading="isLoading || isUploading"
      :max-files="maxFiles"
      :max-file-size="maxFileSize"
      :accepted-file-types="acceptedFileTypes"
      :drag-drop-text="dragDropText"
      :upload-button-text="uploadButtonText"
      :supported-files-text="supportedFilesText"
      :max-size-text="maxSizeText"
      :show-file-preview="showFilePreview"
      :show-supported-files-info="showSupportedFilesInfo"
      :show-max-size-info="showMaxSizeInfo"
      :custom-class="customClass"
      :multiple="multiple ?? false"
      @update:files="onFilesChange"
      @remove="onFileRemove"
      @error="onUploaderError"
      @click="onClick"
    />
  </div>
</template>
