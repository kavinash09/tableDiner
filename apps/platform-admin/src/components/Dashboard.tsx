import { useEffect, useState } from 'react';
import type { PlatformDashboardResponse } from '@tablediner/shared-types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export function Dashboard() {
  const [metrics, setMetrics] = useState<PlatformDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/platform/metrics`);
      if (!res.ok) throw new Error('Failed to fetch platform metrics');
      const data = await res.json();
      setMetrics(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="text-zinc-500 animate-pulse p-8">Loading Platform Analytics...</div>;
  if (error) return <div className="p-4 bg-red-50 text-red-700 rounded-xl">{error}</div>;
  if (!metrics) return null;

  const { financials, gmv, funnel } = metrics;

  return (
    <div className="space-y-8">
      {/* SaaS Financials Row */}
      <div>
        <h2 className="text-lg font-bold text-forest-900 mb-4">SaaS Financials</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Monthly Recurring Revenue" value={`₹${financials.mrr.toFixed(2)}`} />
          <MetricCard title="Annual Run Rate (ARR)" value={`₹${financials.arr.toFixed(2)}`} />
          <MetricCard title="New MRR" value={`₹${financials.newMrr.toFixed(2)}`} />
          <MetricCard title="Churn Rate" value={`${(financials.churnRate * 100).toFixed(1)}%`} highlight={financials.churnRate > 0.05 ? 'red' : 'green'} />
        </div>
      </div>

      {/* GMV Row */}
      <div>
        <h2 className="text-lg font-bold text-forest-900 mb-4">Global Volume (GMV) - Today</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Total GMV Processed" value={`₹${gmv.totalGmv.toFixed(2)}`} highlight="green" />
          <MetricCard title="Global Orders Processed" value={gmv.ordersProcessed.toString()} />
          <MetricCard title="Global Sessions Processed" value={gmv.sessionsProcessed.toString()} />
          <MetricCard title="Average Order Value" value={`₹${gmv.avgOrderValue.toFixed(2)}`} />
        </div>
      </div>

      {/* Tenant Funnel Row */}
      <div>
        <h2 className="text-lg font-bold text-forest-900 mb-4">Tenant Lifecycle Funnel</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <MetricCard title="Leads" value={funnel.leadCount.toString()} />
          <MetricCard title="Onboarding" value={funnel.trialCount.toString()} />
          <MetricCard title="Active" value={funnel.activeCount.toString()} highlight="green" />
          <MetricCard title="Suspended" value={funnel.suspendedCount.toString()} highlight="red" />
          <MetricCard title="Decommissioned" value={funnel.decommissionedCount.toString()} />
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, highlight }: { title: string, value: string, highlight?: 'red' | 'green' }) {
  let valueColor = "text-zinc-900";
  if (highlight === 'red') valueColor = "text-red-600";
  if (highlight === 'green') valueColor = "text-emerald-600";

  return (
    <div className="bg-white p-5 rounded-2xl border border-zinc-100 shadow-sm flex flex-col justify-center">
      <h3 className="text-sm font-medium text-zinc-500 mb-1">{title}</h3>
      <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
    </div>
  );
}

