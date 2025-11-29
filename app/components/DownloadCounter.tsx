"use client";

import { useState, useEffect } from "react";

export default function DownloadCounter() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const response = await fetch(
          `https://cloud.umami.is/api/share/SgUhlS4KYP3zIBI7/events?startAt=0&endAt=${Date.now()}`,
          {
            headers: { Accept: "application/json" },
            cache: "no-store",
          }
        );

        if (response.ok) {
          const data = await response.json();
          let downloadCount = 0;

          if (Array.isArray(data)) {
            const downloadEvent = data.find(
              (e: any) =>
                e.name === "Download" ||
                e.event === "Download" ||
                e.eventName === "Download"
            );
            downloadCount =
              downloadEvent?.value ||
              downloadEvent?.count ||
              downloadEvent?.total ||
              downloadEvent?.y ||
              0;
          } else if (data.events && Array.isArray(data.events)) {
            const downloadEvent = data.events.find(
              (e: any) =>
                e.name === "Download" ||
                e.event === "Download" ||
                e.eventName === "Download"
            );
            downloadCount =
              downloadEvent?.value ||
              downloadEvent?.count ||
              downloadEvent?.total ||
              downloadEvent?.y ||
              0;
          } else if (data["Download"]) {
            downloadCount =
              data["Download"]?.value ||
              data["Download"]?.count ||
              data["Download"] ||
              0;
          }

          setCount(downloadCount);
        }
      } catch (error) {
        console.error("Failed to fetch download count:", error);
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, []);

  if (count === null) {
    return <span>…</span>;
  }

  return <span>{count.toLocaleString()}+</span>;
}
