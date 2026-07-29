import { memo, useEffect, useState } from "react";

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export const CurrentTime = memo(function CurrentTime() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => setTime(formatTime(new Date()));

    update();
    const timer = window.setInterval(update, 30_000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <time className="tabular-nums" aria-live="off">
      {time || "--:--"}
    </time>
  );
});
