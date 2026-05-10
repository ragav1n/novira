"use client"

import * as React from "react"
import { PieChart, Pie, Cell } from "recharts"
import { 
    ChartContainer, 
    ChartTooltip, 
    ChartTooltipContent,
    type ChartConfig 
} from "@/components/ui/pie-chart"
import { cn } from "@/lib/utils"

export type { ChartConfig }

type PieDatum = {
    name?: string;
    value?: number;
    amount?: number;
    color?: string;
    fill?: string;
    stroke?: string;
};

interface BasePieChartProps {
    data: PieDatum[];
    config: ChartConfig;
    innerRadius?: number;
    outerRadius?: number;
    className?: string;
    hideLabel?: boolean;
    nameKey?: string;
    dataKey?: string;
    onSliceClick?: (datum: PieDatum) => void;
    selectedName?: string | null;
    valueFormatter?: (value: number) => string;
}

export function BasePieChart({
    data,
    config,
    innerRadius = 40,
    outerRadius = 60,
    className,
    hideLabel = true,
    nameKey = "name",
    dataKey = "value",
    onSliceClick,
    selectedName,
    valueFormatter
}: BasePieChartProps) {
    const selected = selectedName ? selectedName.toLowerCase() : null;
    return (
        <ChartContainer config={config} className={cn("mx-auto aspect-square", className)}>
            <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel={hideLabel} valueFormatter={valueFormatter} />}
                />
                <Pie
                    data={data}
                    dataKey={dataKey}
                    nameKey={nameKey}
                    innerRadius={innerRadius}
                    outerRadius={outerRadius}
                    paddingAngle={3}
                    cornerRadius={5}
                    strokeWidth={0}
                    isAnimationActive={true}
                    animationBegin={0}
                    animationDuration={1200}
                    animationEasing="ease-out"
                    startAngle={90}
                    endAngle={-270}
                    style={onSliceClick ? { cursor: 'pointer' } : undefined}
                >
                    {data.map((entry, index) => {
                        const dimmed = selected !== null && (entry.name || '').toLowerCase() !== selected;
                        return (
                            <Cell
                                key={`cell-${index}`}
                                fill={entry.color || entry.fill}
                                fillOpacity={dimmed ? 0.3 : 1}
                                onClick={onSliceClick ? () => onSliceClick(entry) : undefined}
                                style={onSliceClick ? { cursor: 'pointer' } : undefined}
                            />
                        );
                    })}
                </Pie>
            </PieChart>
        </ChartContainer>
    )
}
