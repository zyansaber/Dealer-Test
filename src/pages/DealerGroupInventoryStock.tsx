// src/pages/DealerGroupInventoryStock.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Download, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import Sidebar from "@/components/Sidebar";
import OrderList from "@/components/OrderList";
import ModelRangeCards from "@/components/ModelRangeCards";
import {
  subscribeToSchedule,
  subscribeToSpecPlan,
  subscribeToDateTrack,
  subscribeDealerConfig,
  subscribeAllDealerConfigs,
} from "@/lib/firebase";
import type { ScheduleItem, SpecPlan, DateTrack } from "@/types";
import { isDealerGroup } from "@/types/dealer";
import * as XLSX from "xlsx";

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
  const { dealerSlug: rawDealerSlug, selectedDealerSlug } = useParams<{ 
    dealerSlug: string;
    selectedDealerSlug?: string;
  }>();
  const navigate = useNavigate();
  const dealerSlug = useMemo(() => normalizeDealerSlug(rawDealerSlug), [rawDealerSlug]);

  const [allOrders, setAllOrders] = useState<ScheduleItem[]>([]);
  const [specPlans, setSpecPlans] = useState<SpecPlan>({});
  const [dateTracks, setDateTracks] = useState<DateTrack>({});
  const [dealerConfig, setDealerConfig] = useState<any>(null);
  const [allDealerConfigs, setAllDealerConfigs] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [configLoading, setConfigLoading] = useState(true);

  const [modelRangeFilter, setModelRangeFilter] = useState<{ modelRange?: string; customerType?: string }>({});

  useEffect(() => {
    const unsubSchedule = subscribeToSchedule((data) => {
      setAllOrders(data || []);
      setLoading(false);
    });
    const unsubSpecPlan = subscribeToSpecPlan((data) => setSpecPlans(data || {}));
    const unsubDateTrack = subscribeToDateTrack((data) => setDateTracks(data || {}));
    return () => {
      unsubSchedule?.();
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

  useEffect(() => {
    if (!configLoading && dealerConfig && isDealerGroup(dealerConfig) && !selectedDealerSlug) {
      const firstDealer = includedDealerSlugs[0];
      if (firstDealer) {
        navigate(`/dealergroup/${rawDealerSlug}/${firstDealer}/inventorystock`, { replace: true });
      }
    }
  }, [configLoading, dealerConfig, selectedDealerSlug, includedDealerSlugs, rawDealerSlug, navigate]);

  const displayDealerSlugs = useMemo(() => {
    if (selectedDealerSlug) {
      return [selectedDealerSlug];
    }
    return includedDealerSlugs;
  }, [selectedDealerSlug, includedDealerSlugs]);

  const dealerOrders = useMemo(() => {
    if (!dealerSlug) return [];
    return (allOrders || []).filter((o) => {
      const orderDealerSlug = slugifyDealerName(o.Dealer);
      return displayDealerSlugs.includes(orderDealerSlug);
    });
  }, [allOrders, displayDealerSlugs, dealerSlug]);

  const stockOrders = useMemo(() => {
    return dealerOrders.filter((order) => 
      (order.Customer || "").toLowerCase().endsWith("stock")
    );
  }, [dealerOrders]);

  const filteredOrders = useMemo(() => {
    return stockOrders.filter(order => {
      if (modelRangeFilter.modelRange) {
        const chassisPrefix = order.Chassis?.substring(0, 3).toUpperCase();
        if (chassisPrefix !== modelRangeFilter.modelRange) return false;
      }
      return true;
    });
  }, [stockOrders, modelRangeFilter]);

  const dealerDisplayName = useMemo(() => {
    if (selectedDealerSlug) {
      const selectedConfig = allDealerConfigs[selectedDealerSlug];
      if (selectedConfig?.name) return selectedConfig.name;
      const fromOrder = dealerOrders.find(o => slugifyDealerName(o.Dealer) === selectedDealerSlug)?.Dealer;
      return fromOrder || prettifyDealerName(selectedDealerSlug);
    }
    if (dealerConfig?.name) return dealerConfig.name;
    const fromOrder = dealerOrders[0]?.Dealer;
    return fromOrder && fromOrder.trim().length > 0
      ? fromOrder
      : prettifyDealerName(dealerSlug);
  }, [dealerConfig, dealerOrders, dealerSlug, selectedDealerSlug, allDealerConfigs]);

  const hasAccess = useMemo(() => {
    if (configLoading) return true;
    if (!dealerConfig) return false;
    return dealerConfig.isActive;
  }, [dealerConfig, configLoading]);

  const exportToExcel = () => {
    if (filteredOrders.length === 0) return;
    const excelData = filteredOrders.map((order) => {
      const dateTrack =
        (dateTracks as any)[order.Chassis] ||
        (Object.values(dateTracks) as any[]).find(
          (dt: any) => dt?.["Chassis Number"] === order.Chassis
        );
      return {
        Chassis: order.Chassis,
        Customer: order.Customer,
        Model: order.Model,
        "Model Year": order["Model Year"],
        Dealer: order.Dealer,
        "Forecast Production Date": order["Forecast Production Date"],
        "Order Received Date": order["Order Received Date"] || "",
        "Signed Plans Received": order["Signed Plans Received"] || "",
        "Purchase Order Sent": order["Purchase Order Sent"] || "",
        "Price Date": order["Price Date"] || "",
        "Request Delivery Date": order["Request Delivery Date"] || "",
        "Regent Production": order["Regent Production"] || "",
        Shipment: (order as any).Shipment || "",
        "Left Port": (dateTrack || {})["Left Port"] || "",
        "Received in Melbourne": (dateTrack || {})["Received in Melbourne"] || "",
        "Dispatched from Factory": (dateTrack || {})["Dispatched from Factory"] || "",
      };
    });

    try {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);
      const colWidths = Object.keys(excelData[0] || {}).map((key) => ({
        wch: Math.max(key.length, 15),
      }));
      (ws as any)["!cols"] = colWidths;
      const date = new Date().toISOString().split("T")[0];
      const filename = `${dealerDisplayName}_Stock_${date}.xlsx`;
      XLSX.utils.book_append_sheet(wb, ws, "Stock");
      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error("Export excel failed:", err);
    }
  };

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
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        orders={filteredOrders}
        selectedDealer={dealerDisplayName}
        onDealerSelect={() => {}}
        hideOtherDealers={true}
        currentDealerName={dealerDisplayName}
        showStats={false}
        isGroup={isDealerGroup(dealerConfig)}
        includedDealers={includedDealerNames}
      />

      <main className="flex-1 p-6 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">
              Factory Inventory — {dealerDisplayName}
            </h1>
            <p className="text-muted-foreground mt-1">
              Stock Vehicles ({filteredOrders.length} of {stockOrders.length} vehicles)
            </p>
          </div>
          <Button
            onClick={exportToExcel}
            disabled={filteredOrders.length === 0}
            className="bg-green-600 hover:bg-green-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
        </header>

        <ModelRangeCards 
          orders={stockOrders} 
          onFilterChange={setModelRangeFilter}
        />

        {filteredOrders.length === 0 ? (
          <div className="text-muted-foreground">
            {stockOrders.length === 0 ? (
              <>No stock vehicles found for <span className="font-medium">{dealerDisplayName}</span>.</>
            ) : (
              <>No stock vehicles match your current filters.</>
            )}
          </div>
        ) : (
          <OrderList orders={filteredOrders} specPlans={specPlans} dateTracks={dateTracks} />
        )}
      </main>
    </div>
  );
}
