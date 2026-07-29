import { ReactNode } from "react";

type WaiterPageContainerProps = {
  children: ReactNode;
};

export function WaiterPageContainer({ children }: WaiterPageContainerProps) {
  return <>{children}</>;
}
