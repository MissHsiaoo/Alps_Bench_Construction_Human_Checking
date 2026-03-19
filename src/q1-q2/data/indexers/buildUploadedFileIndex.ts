import type { UploadedFileIndex } from '../../types';

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/');
}

export function buildUploadedFileIndex(fileList: FileList | File[]): UploadedFileIndex {
  const files = Array.from(fileList);

  if (files.length === 0) {
    throw new Error('No files were provided.');
  }

  const firstRelativePath = files[0].webkitRelativePath
    ? normalizePath(files[0].webkitRelativePath)
    : normalizePath(files[0].name);
  const rootName = firstRelativePath.split('/')[0] || files[0].name;

  const filesByRelativePath = new Map<string, File>();

  files.forEach((file) => {
    const originalPath = file.webkitRelativePath
      ? normalizePath(file.webkitRelativePath)
      : normalizePath(file.name);
    const pathSegments = originalPath.split('/');
    const strippedRelativePath =
      pathSegments.length > 1 ? pathSegments.slice(1).join('/') : originalPath;

    filesByRelativePath.set(strippedRelativePath, file);
  });

  return {
    rootName,
    filesByRelativePath,
    allRelativePaths: Array.from(filesByRelativePath.keys()).sort(),
  };
}
