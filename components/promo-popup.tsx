"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Sparkles, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPHP } from "@/lib/utils";

const IMAGE_BASE_URL = process.env.NEXT_PUBLIC_IMAGE_URL ?? "";

// How many promos to show (the popup shows up to this many, newest first).
const MAX_PROMOS = 5;
// Delay before the popup appears after page load.
const OPEN_DELAY_MS = 800;
// Shown once per browser session so it doesn't nag on every navigation.
const SESSION_KEY = "quanta-promo-popup-seen";

type PromoProduct = {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number | null;
  originalPrice?: number | null;
  inStock: boolean;
  image: string;
  isPromo?: boolean;
  promoStart?: string | null;
  promoEnd?: string | null;
};

function resolveImageUrl(path: string | null | undefined): string {
  if (!path) return "/products/placeholder.jpg";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${IMAGE_BASE_URL}${path}`;
}

// Same rule as the admin page: toggle on AND today inside the date range.
function isPromoActive(product: PromoProduct): boolean {
  if (!product.isPromo) return false;

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (product.promoStart && now < new Date(product.promoStart)) return false;
  if (product.promoEnd) {
    const end = new Date(product.promoEnd);
    end.setHours(23, 59, 59, 999);
    if (now > end) return false;
  }
  return true;
}

function formatEnds(product: PromoProduct): string {
  if (!product.promoEnd) return "Limited time";
  const date = new Date(product.promoEnd).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
  return `Ends ${date}`;
}

function percentOff(product: PromoProduct): number | null {
  if (!product.originalPrice || product.price == null) return null;
  if (product.originalPrice <= product.price) return null;
  return Math.round(
    ((product.originalPrice - product.price) / product.originalPrice) * 100,
  );
}

// Newest promos first: latest start date, falling back to the latest id.
function sortLatest(a: PromoProduct, b: PromoProduct): number {
  const aStart = a.promoStart ? new Date(a.promoStart).getTime() : 0;
  const bStart = b.promoStart ? new Date(b.promoStart).getTime() : 0;
  if (aStart !== bStart) return bStart - aStart;
  return String(b.id).localeCompare(String(a.id), undefined, { numeric: true });
}

export function PromoPopup() {
  const [open, setOpen] = useState(false);
  const [promos, setPromos] = useState<PromoProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Skip if already seen this session.
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return;
    } catch {
      // storage unavailable — just show it
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function load() {
      try {
        const res = await fetch("/api/products");
        if (!res.ok) throw new Error("Failed to load promos");
        const data = await res.json();

        const list: PromoProduct[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.products)
            ? data.products
            : Array.isArray(data?.data)
              ? data.data
              : [];

        const live = list
          .filter(isPromoActive)
          .sort(sortLatest)
          .slice(0, MAX_PROMOS);

        if (cancelled) return;
        setPromos(live);

        // Only open if there's something to show.
        if (live.length > 0) {
          timer = setTimeout(() => setOpen(true), OPEN_DELAY_MS);
        }
      } catch {
        // Silent failure: a promo popup should never break the homepage.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      try {
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch {
        // ignore
      }
    }
  }

  function handleShopNow() {
    handleOpenChange(false);
    document
      .getElementById("shop")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (isLoading || promos.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[88vh] max-w-lg flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-moss-100 bg-moss-50 px-6 py-5 text-left">
          <div className="mb-1 flex items-center gap-1.5 text-moss-900">
            <Sparkles className="h-4 w-4 text-yellow-500" />
            <span className="text-xs font-medium">Special promos</span>
          </div>
          <DialogTitle className="font-display text-2xl font-semibold text-moss-900">
            Deals you can grab right now
          </DialogTitle>
          <DialogDescription>
            The latest {promos.length} promos from our catalog. Prices are valid
            while the promo runs.
          </DialogDescription>
        </DialogHeader>

        <ul className="divide-y divide-moss-100 overflow-y-auto">
          {promos.map((product) => {
            const off = percentOff(product);
            return (
              <li key={product.id} className="flex gap-3 px-6 py-3.5">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-moss-100">
                  <Image
                    src={resolveImageUrl(product.image)}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-moss-900">
                        {product.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {product.brand}
                      </p>
                    </div>
                    {off !== null && (
                      <Badge className="shrink-0 border-transparent bg-yellow-300 text-moss-950">
                        {off}% off
                      </Badge>
                    )}
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-sm font-semibold text-moss-900">
                      {product.price != null ? formatPHP(product.price) : "—"}
                    </span>
                    {product.originalPrice ? (
                      <span className="text-xs text-muted-foreground line-through">
                        {formatPHP(product.originalPrice)}
                      </span>
                    ) : null}
                    <span className="text-[11px] text-muted-foreground">
                      {formatEnds(product)}
                    </span>
                    {!product.inStock && (
                      <span className="text-[11px] font-medium text-red-600">
                        Out of stock
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <DialogFooter className="border-t border-moss-100 px-6 py-4">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Maybe later
          </Button>
          <Button onClick={handleShopNow}>Shop the promos</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
