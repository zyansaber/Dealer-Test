// src/pages/DealerGroupInventoryStock.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import Sidebar from "@/components/Sidebar";
import OrderList from "@/components/OrderList";
import {
  subscribeToStock,
  subscribeToReallocation,
  subscribeToSpecPlan,
  subscribeToDateTrack,
  subscribeDealerConfig,
  subscribeAllDealerConfigs,
} from "@/lib/firebase";
import type { ScheduleItem, SpecPlan, DateTrack } from "@/types";
import { isDealerGroup } from "@/types/dealer";

function normalizeDealerSlug(raw?: string): string {
  const slug = (raw || "").toLowerCase();
  const m = slug.match(/^(.*?)-([a-z0-9]{6})$/);
  return m ? m[1] : slug;
}

function slugifyDealerName(name?: string): string {
  return (name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function prettifyDealerName(slug: string): string {
  const s = slug.replace(/-/g, " ").trim();
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DealerGroupInventoryStock() {
  const { dealerSlug: rawDealerSlug } = useParams<{ dealerSlug: string }>();
  const dealerSlug = useMemo(() => normalizeDealerSlug(rawDealerSlug), [rawDealerSlug]);

  const [stockData, setStockData] = useState<any>({});
  const [reallocationData, setReallocationData] = useState<any>({});
  const [specPlans, setSpecPlans] = useState<SpecPlan>({});
  const [dateTracks, setDateTracks] = useState<DateTrack>({});
  const [dealerConfig, setDealerConfig] = useState<any>(null);
  const [allDealerConfigs, setAllDealerConfigs] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [configLoading, setConfigLoading] = useState(true);

  useEffect(() => {
    const unsubStock = subscribeToStock((data) => {
      setStockData(data || {});
      setLoading(false);
    });
    const unsubRealloc = subscribeToReallocation((data) => setReallocationData(data || {}));
    const unsubSpecPlan = subscribeToSpecPlan((data) => setSpecPlans(data || {}));
    const unsubDateTrack = subscribeToDateTrack((data) => setDateTracks(data || {}));

    return () => {
      unsubStock?.();
      unsubRealloc?.();
      unsubSpecPlan?.();
      unsubDateTrack?.();
    };
  }, []);

  useEffect(() => {
    if (!dealerSlug) return;

    const unsubConfig = subscribeDealerConfig(dealerSlug, (config) => {
      setDealerConfig(config);
      setConfigLoading(false);
    });

    return unsubConfig;
  }, [dealerSlug]);

  useEffect(() => {
    const unsubAllConfigs = subscribeAllDealerConfigs((data) => {
      setAllDealerConfigs(data || {});
    });

    return unsubAllConfigs;
  }, []);

  const includedDealerSlugs = useMemo(() => {
    if (!dealerConfig || !isDealerGroup(dealerConfig)) {
      return [dealerSlug];
    }
    return dealerConfig.includedDealers || [];
  }, [dealerConfig, dealerSlug]);

  const includedDealerNames = useMemo(() => {
    if (!dealerConfig || !isDealerGroup(dealerConfig)) {
      return null;
    }
    
    return includedDealerSlugs.map(slug => {
      const config = allDealerConfigs[slug];
      return {
        slug,
        name: config?.name || prettifyDealerName(slug)
      };
    });
  }, [dealerConfig, includedDealerSlugs, allDealerConfigs]);

  const stockOrders = useMemo(() => {
    const stockArr = Array.isArray(stockData)
      ? stockData.filter(Boolean)
      : Object.values(stockData).filter(Boolean);

    return stockArr.filter((item: any) => {
      const orderDealerSlug = slugifyDealerName(item?.Dealer);
      return includedDealerSlugs.includes(orderDealerSlug);
    });
  }, [stockData, includedDealerSlugs]);

  const reallocationOrders = useMemo(() => {
    const reallocArr = Array.isArray(reallocationData)
      ? reallocationData.filter(Boolean)
      : Object.values(reallocationData).filter(Boolean);

    return reallocArr.filter((item: any) => {
      const orderDealerSlug = slugifyDealerName(item?.Dealer);
      return includedDealerSlugs.includes(orderDealerSlug);
    });
  }, [reallocationData, includedDealerSlugs]);

  const dealerDisplayName = useMemo(() => {
    if (dealerConfig?.name) return dealerConfig.name;
    return prettifyDealerName(dealerSlug);
  }, [dealerConfig, dealerSlug]);

  const hasAccess = useMemo(() => {
    if (configLoading) return true;
    if (!dealerConfig) return false;
    return dealerConfig.isActive;
  }, [dealerConfig, configLoading]);

  if (!configLoading && !hasAccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <Card className="max-w-md">
          <CardContent className="text-center py-16">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <CardTitle className="text-xl text-slate-700 mb-2">Access Denied</CardTitle>
            <p className="text-slate-500 mb-6">
              This dealer portal is currently inactive or does not exist.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading || configLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Loading inventory...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        orders={[...stockOrders, ...reallocationOrders]}
        selectedDealer={dealerDisplayName}
        onDealerSelect={() => {}}
        hideOtherDealers={true}
        currentDealerName={dealerDisplayName}
        showStats={false}
        isGroup={isDealerGroup(dealerConfig)}
        includedDealers={includedDealerNames}
      />

      <main className="flex-1 p-6 space-y-6">
        <header>
          <h1 className="text-2xl font-semibold">Factory Inventory — {dealerDisplayName}</h1>
          <p className="text-muted-foreground mt-1">
            Stock and reallocation orders
          </p>
        </header>

        {stockOrders.length === 0 && reallocationOrders.length === 0 ? (
          <div className="text-muted-foreground">No inventory orders found.</div>
        ) : (
          <>
            {stockOrders.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Stock Orders ({stockOrders.length})</h2>
                <OrderList orders={stockOrders} specPlans={specPlans} dateTracks={dateTracks} />
              </div>
            )}

            {reallocationOrders.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Reallocation Orders ({reallocationOrders.length})</h2>
                <OrderList orders={reallocationOrders} specPlans={specPlans} dateTracks={dateTracks} />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
