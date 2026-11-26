import { useEffect, useState } from "react";

/** Phone under 640 px (TabBar); "All areas" for the supervisor from 1600 px. Read once mounted, then on resize. */
export function useWide() {
  const [state, setState] = useState({ phone: false, allAreas: false });
  useEffect(() => {
    const phone = window.matchMedia("(max-width: 639.98px)");
    const big = window.matchMedia("(min-width: 1600px)");
    const read = () => setState({ phone: phone.matches, allAreas: big.matches });
    read();
    phone.addEventListener("change", read);
    big.addEventListener("change", read);
    return () => {
      phone.removeEventListener("change", read);
      big.removeEventListener("change", read);
    };
  }, []);
  return state;
}
