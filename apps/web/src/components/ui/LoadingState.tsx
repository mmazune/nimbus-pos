import { Card } from "./Card";
import { Skeleton } from "./Skeleton";

type LoadingStateProps = {
  title?: string;
};

export function LoadingState({ title = "Loading" }: LoadingStateProps) {
  return (
    <Card className="max-w-xl">
      <p className="text-sm font-semibold text-text-secondary">{title}</p>
      <div className="mt-5 grid gap-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-12 w-full" />
      </div>
    </Card>
  );
}
