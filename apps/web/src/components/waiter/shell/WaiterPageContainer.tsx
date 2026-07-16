import { ReactNode } from "react";

type WaiterPageContainerProps = {
  children: ReactNode;
};

export function WaiterPageContainer({ children }: WaiterPageContainerProps) {
  return (
    <main className="mx-auto min-h-screen min-w-[1280px] max-w-[1600px] px-8 pb-28 pt-36">
      {children}
    </main>
  );
}
