'use client';

import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ChartConfig, BasePieChart } from '@/components/charts/base-pie-chart';

const PAYMENT_COLORS: Record<string, string> = {
    cash: '#22C55E',
    'debit card': '#3B82F6',
    'credit card': '#A855F7',
    upi: '#F59E0B',
    'bank transfer': '#06B6D4',
    other: '#EC4899',
};

const paymentChartConfig: ChartConfig = {
    cash: { label: 'Cash', color: PAYMENT_COLORS.cash },
    'debit card': { label: 'Debit Card', color: PAYMENT_COLORS['debit card'] },
    'credit card': { label: 'Credit Card', color: PAYMENT_COLORS['credit card'] },
    upi: { label: 'UPI', color: PAYMENT_COLORS.upi },
    'bank transfer': { label: 'Bank Transfer', color: PAYMENT_COLORS['bank transfer'] },
    other: { label: 'Other', color: PAYMENT_COLORS.other },
};

type PaymentItem = {
    name: string;
    amount: number;
    value: number;
    fill: string;
};

interface Props {
    paymentBreakdown: { name: string; value: number; fill: string }[];
    categorizedPayment: PaymentItem[];
    formatCurrency: (amount: number) => string;
}

function PaymentBreakdownCardInner({ paymentBreakdown, categorizedPayment, formatCurrency }: Props) {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80">
                    Spending by Payment Method
                </span>
            </div>
            <Card className="bg-card/40 border-none shadow-none backdrop-blur-md overflow-hidden">
                <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-start gap-6">
                    <div className="w-32 h-32 relative flex-shrink-0">
                        {paymentBreakdown.length > 0 ? (
                            <BasePieChart
                                data={paymentBreakdown}
                                config={paymentChartConfig}
                                innerRadius={40}
                                outerRadius={60}
                                hideLabel={true}
                                valueFormatter={(v) => `${Math.round(v)}%`}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground text-[10px] font-bold uppercase">
                                No Data
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 flex-1 w-full">
                        {categorizedPayment.map((pay) => (
                            <div key={pay.name} className="flex flex-col p-3 rounded-2xl bg-secondary/10 border border-white/5">
                                <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/80 uppercase tracking-widest font-bold">
                                    <div className="w-1 h-1 rounded-full shadow-glow" style={{ backgroundColor: pay.fill }} />
                                    {pay.name}
                                </span>
                                <span className="text-sm font-bold mt-1">{formatCurrency(pay.amount)}</span>
                                <div className="h-1 w-full bg-secondary/20 rounded-full mt-2 overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-1000"
                                        style={{ width: `${pay.value}%`, backgroundColor: pay.fill }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export const PaymentBreakdownCard = memo(PaymentBreakdownCardInner);
