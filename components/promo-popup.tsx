"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, formatPHP } from "@/lib/utils";

const IMAGE_BASE_URL = process.env.NEXT_PUBLIC_IMAGE_URL ?? "";

// How many promos to show (the popup shows up to this many, newest first).
const MAX_PROMOS = 5;
// Delay before the popup appears after page load.
const OPEN_DELAY_MS = 800;
// Shown once per browser session so it doesn't nag on every navigation.
// Must match the id on the FeaturedProducts <section>.
const PROMOS_SECTION_ID = "special-promos";
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
  const [index, setIndex] = useState(0);

  const total = promos.length;
  const goNext = () => setIndex((i) => (i + 1) % Math.max(total, 1));
  const goPrev = () =>
    setIndex((i) => (i - 1 + Math.max(total, 1)) % Math.max(total, 1));

  // Left/right arrow keys while the popup is open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, total]);

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
        const res = await fetch("/api/products?promo=active", {
          cache: "no-store",
        });
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
    // Make sure the strip is on its "Limited time" tab, then scroll to it.
    window.dispatchEvent(new Event("show-promos-tab"));
    // Wait for the dialog to finish closing so the page can scroll again.
    setTimeout(() => {
      document
        .getElementById(PROMOS_SECTION_ID)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 250);
  }

  if (isLoading || promos.length === 0) return null;

  const product = promos[index];
  const off = percentOff(product);
  const soldOut = !product.inStock;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-2rem)] max-w-3xl gap-0 overflow-hidden rounded-3xl border-0 p-0">
        <div className="grid max-h-[92vh] overflow-y-auto md:grid-cols-2">
          {/* Left: product on brand green, with the carousel controls */}
          <div className="flex flex-col items-center justify-center gap-4 bg-[#00A552] px-5 py-6 md:px-7 md:py-8">
            <div className="relative aspect-square w-full max-w-[200px] overflow-hidden rounded-3xl bg-white shadow-lg sm:max-w-[300px]">
              <Image
                key={product.id}
                src={resolveImageUrl(product.image)}
                alt={product.name}
                fill
                className={cn(
                  "object-cover",
                  soldOut && "opacity-40 grayscale",
                )}
                sizes="300px"
                priority
              />
              {off !== null && !soldOut && (
                <span className="absolute left-3 top-3 z-10 rounded-full bg-yellow-300 px-3 py-1 text-xs font-bold text-moss-950 shadow-sm">
                  -{off}%
                </span>
              )}
              {soldOut && (
                <span className="absolute inset-0 z-10 flex items-center justify-center bg-white/40">
                  <span className="rounded-full bg-moss-900/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                    Sold Out
                  </span>
                </span>
              )}
            </div>

            {total > 1 && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={goPrev}
                  aria-label="Previous promo"
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-white transition-colors hover:bg-white hover:text-green-600"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <div className="flex items-center gap-1.5">
                  {promos.map((p, i) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setIndex(i)}
                      aria-label={`Go to promo ${i + 1}`}
                      aria-current={i === index}
                      className={cn(
                        "h-2 rounded-full transition-all",
                        i === index
                          ? "w-5 bg-yellow-300"
                          : "w-2 bg-white/50 hover:bg-white/80",
                      )}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={goNext}
                  aria-label="Next promo"
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-white transition-colors hover:bg-white hover:text-green-600"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Right: details + CTA */}
          <div className="flex flex-col justify-center gap-5 bg-white px-6 py-6 md:px-8 md:py-8">
            <DialogHeader className="space-y-2 text-left">
              <span className="inline-flex w-fit items-center gap-1 rounded-full bg-yellow-300 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-moss-950">
                <Sparkles className="h-3 w-3" />
                Limited time
              </span>
              <DialogTitle className="font-display text-2xl font-medium leading-tight text-moss-900">
                Deals you can grab right now
              </DialogTitle>
              <DialogDescription className="sr-only">
                Browse the latest promos using the arrows.
              </DialogDescription>
            </DialogHeader>

            <div className="border-t border-moss-100 pt-4" aria-live="polite">
              <p className="truncate text-[11px] font-medium uppercase tracking-wide text-moss-500">
                {product.brand}
              </p>
              <h3 className="mt-1 line-clamp-2 font-display text-lg font-medium leading-snug text-moss-900">
                {product.name}
              </h3>

              <div className="mt-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span className="font-display text-3xl font-semibold text-moss-900">
                  {product.price != null ? formatPHP(product.price) : "—"}
                </span>
                {product.originalPrice ? (
                  <span className="font-mono text-sm text-muted-foreground line-through">
                    {formatPHP(product.originalPrice)}
                  </span>
                ) : null}
              </div>

              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-moss-50 px-3 py-1 text-xs font-medium text-moss-700">
                <CalendarClock className="h-3.5 w-3.5" />
                {formatEnds(product)}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={handleShopNow}
                className="h-11 flex-1 rounded-full font-semibold"
              >
                Shop the promos
              </Button>
              <Button
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                className="h-11 rounded-full text-moss-600"
              >
                Maybe later
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
