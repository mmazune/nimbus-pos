import { useEffect, useState } from "react";

/** Phone layout below 768 px wide (drawings Order-Phone, -Check, -Item at 390 × 844). */
export const PHONE_QUERY = "(max-width: 767px)";

export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY);
    const update = () => setPhone(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return phone;
}
