import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';

interface JsonPreviewBlockProps {
  title: string;
  description?: string;
  value: unknown;
}

export function JsonPreviewBlock({ title, description, value }: JsonPreviewBlockProps) {
  return (
    <Card className="min-w-0 overflow-hidden border-slate-200/80 bg-white/90 shadow-sm">
      <CardHeader className="border-b border-slate-100/80 bg-gradient-to-r from-white to-slate-50">
        <CardTitle className="text-slate-900">{title}</CardTitle>
        {description ? <CardDescription className="text-slate-600">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="pt-6">
        <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">
          {JSON.stringify(value, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}
