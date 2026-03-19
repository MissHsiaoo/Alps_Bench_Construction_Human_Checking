import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../../components/ui/card';
import { TranslatedText } from './TranslatedText';

interface TextBlockItem {
  label?: string;
  text: string;
}

interface TextBlockProps {
  title: string;
  description?: string;
  items: TextBlockItem[];
  translationEnabled?: boolean;
}

export function TextBlock({
  title,
  description,
  items,
  translationEnabled = false,
}: TextBlockProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Card className="min-w-0 overflow-hidden border-slate-200/80 bg-white/90 shadow-sm">
      <CardHeader className="border-b border-slate-100/80 bg-gradient-to-r from-white to-slate-50">
        <CardTitle className="text-slate-900">{title}</CardTitle>
        {description ? <CardDescription className="text-slate-600">{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        {items.map((item, index) => (
          <div key={`${item.label ?? title}-${index}`} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {item.label ? (
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
            ) : null}
            <TranslatedText text={item.text} translationEnabled={translationEnabled} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
