import { useEffect, useRef } from 'react';
import { FolderTree, Upload } from 'lucide-react';

import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';

interface FileSourceSelectorProps {
  onFolderSelected: (files: FileList) => void;
  isLoading: boolean;
}

export function FileSourceSelector({ onFolderSelected, isLoading }: FileSourceSelectorProps) {
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!folderInputRef.current) {
      return;
    }

    folderInputRef.current.setAttribute('webkitdirectory', '');
    folderInputRef.current.setAttribute('directory', '');
  }, []);

  const handleFolderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;

    if (files && files.length > 0) {
      onFolderSelected(files);
    }

    event.target.value = '';
  };

  return (
    <Card className="overflow-hidden border-slate-200/80 bg-white/90 shadow-sm">
      <CardHeader className="border-b border-slate-100/80 bg-gradient-to-r from-white to-sky-50/60">
        <CardTitle className="flex items-center gap-2 text-slate-900">
          <FolderTree className="h-5 w-5 text-slate-700" />
          Dataset Import
        </CardTitle>
        <CardDescription className="text-slate-600">
          Upload the local <code>manual_check_data</code> folder. The workbench reads manifest indexes first
          and only lazy-loads the active <code>item.json</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        <input
          ref={folderInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={handleFolderChange}
        />

        <div className="rounded-2xl border border-dashed border-sky-300 bg-gradient-to-br from-sky-50 to-white p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-slate-900">Recommended input</p>
              <p className="text-sm text-slate-600">
                Select the root <code>manual_check_data</code> folder so the app can discover both Q1 and
                Q2 tracks safely.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              disabled={isLoading}
              className="gap-2 self-start"
            >
              <Upload className="h-4 w-4" />
              {isLoading ? 'Reading folder...' : 'Upload Dataset Folder'}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-2 font-medium text-slate-900">Works well today</p>
            <ul className="list-disc space-y-1 pl-4">
              <li>Root folder import from <code>manual_check_data</code></li>
              <li>Manifest discovery for Q1 and Q2</li>
              <li>Lazy loading of one <code>item.json</code> at a time</li>
            </ul>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="mb-2 font-medium text-slate-900">Included in this workbench</p>
            <ul className="list-disc space-y-1 pl-4">
              <li>Task-specific left-side display composition</li>
              <li>Right-side annotation forms and save flow</li>
              <li>Annotation-only export and local draft recovery</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
