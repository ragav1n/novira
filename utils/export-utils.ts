import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO, differenceInDays } from 'date-fns';
import { DateRange } from 'react-day-picker';

interface ExportTransaction {
    date: string;
    description: string;
    category: string;
    amount: number;
    currency?: string;
    payment_method: string;
    exchange_rate?: number;
    base_currency?: string;
    converted_amount?: number;
    bucket_id?: string;
    group_id?: string;
    is_recurring?: boolean;
}

const CATEGORY_COLORS: Record<string, [number, number, number]> = {
    food: [138, 43, 226],      // Electric Purple
    transport: [255, 107, 107], // Coral
    bills: [78, 205, 196],     // Teal
    shopping: [249, 199, 79],  // Yellow
    healthcare: [255, 159, 28], // Orange
    entertainment: [255, 20, 147], // Deep Pink
    others: [199, 244, 100],    // Lime
    uncategorized: [99, 102, 241], // Indigo
};

const getCategoryColor = (category: string): [number, number, number] => {
    return CATEGORY_COLORS[category.toLowerCase()] || [150, 150, 150];
};

const METHOD_COLORS: Record<string, [number, number, number]> = {
    cash: [74, 222, 128],      // Green
    card: [96, 165, 250],      // Blue
    online: [248, 113, 113],    // Red
    other: [156, 163, 175],    // Gray
    'credit card': [96, 165, 250],
    'debit card': [129, 140, 248],
    upi: [138, 43, 226],       // Purple
};

const getMethodColor = (method: string): [number, number, number] => {
    const m = (method || 'Other').toLowerCase();
    return METHOD_COLORS[m] || METHOD_COLORS.other;
};

// Helper: Draw Pie Chart
const drawPieChart = (doc: jsPDF, data: { label: string, value: number, color: [number, number, number] }[], x: number, y: number, radius: number) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    if (total <= 0) {
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text('No data', x, y, { align: 'center' });
        return;
    }

    let startAngle = 0;
    data.forEach((item) => {
        if (item.value <= 0) return;

        const sliceAngle = (item.value / total) * 2 * Math.PI;
        doc.setFillColor(item.color[0], item.color[1], item.color[2]);

        const segments = 30; // Quality
        const step = sliceAngle / segments;

        for (let i = 0; i < segments; i++) {
            const angle1 = startAngle + i * step;
            const angle2 = startAngle + (i + 1) * step;

            const x1 = x + radius * Math.cos(angle1);
            const y1 = y + radius * Math.sin(angle1);
            const x2 = x + radius * Math.cos(angle2);
            const y2 = y + radius * Math.sin(angle2);

            doc.triangle(x, y, x1, y1, x2, y2, 'F');
        }

        startAngle += sliceAngle;
    });

    // Legend
    let legendY = y - radius;
    data.filter(item => item.value > 0).slice(0, 6).forEach((item, i) => {
        doc.setFillColor(item.color[0], item.color[1], item.color[2]);
        doc.rect(x + radius + 5, legendY + (i * 6), 3, 3, 'F');
        doc.setFontSize(7);
        doc.setTextColor(50, 50, 50);
        const percent = ((item.value / total) * 100).toFixed(0);
        const label = item.label.length > 12 ? item.label.substring(0, 10) + '..' : item.label;
        doc.text(`${label} (${percent}%)`, x + radius + 10, legendY + (i * 6) + 2.5);
    });
};

// Helper: Draw Bar Chart
const drawBarChart = (doc: jsPDF, data: { label: string, value: number }[], x: number, y: number, width: number, height: number, color: [number, number, number]) => {
    if (data.length === 0) return;
    const maxValue = Math.max(...data.map(d => d.value), 1);
    const barWidth = (width / data.length) * 0.7;
    const spacing = (width / data.length) * 0.3;

    doc.setDrawColor(200, 200, 200);
    doc.line(x, y + height, x + width, y + height); // X-axis

    data.forEach((item, i) => {
        const barHeight = (item.value / maxValue) * height;
        doc.setFillColor(color[0], color[1], color[2]);
        doc.rect(x + (i * (barWidth + spacing)), y + height - barHeight, barWidth, barHeight, 'F');

        doc.setFontSize(6);
        doc.setTextColor(100, 100, 100);
        doc.text(item.label, x + (i * (barWidth + spacing)) + barWidth / 2, y + height + 5, { align: 'center' });
    });
};

// Helper: Draw Progress Bar
const drawProgressBar = (doc: jsPDF, percent: number, x: number, y: number, width: number, height: number, color: [number, number, number]) => {
    doc.setFillColor(240, 240, 240);
    doc.rect(x, y, width, height, 'F');

    const fillWidth = Math.min(width, (percent / 100) * width);
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(x, y, fillWidth, height, 'F');
};

export const generateCSV = (
    transactions: ExportTransaction[],
    currency: string,
    convertAmount: (amount: number, fromCurrency: string) => number,
    formatCurrency: (amount: number, currency?: string) => string,
    buckets: any[] = [],
    groups: any[] = []
) => {
    const bucketMap = Object.fromEntries(buckets.map(b => [b.id, b]));
    const groupMap = Object.fromEntries(groups.map(g => [g.id, g]));

    const headers = ['Date', 'Description', 'Category', 'Bucket', 'Group', 'Payment Method', 'Amount', 'Currency', 'Converted Amount', 'Recurring'];
    const rows = transactions.map(tx => {
        const converted = tx.converted_amount || convertAmount(Number(tx.amount), tx.currency || 'USD');
        const bucket = tx.bucket_id ? bucketMap[tx.bucket_id] : null;
        const group = tx.group_id ? groupMap[tx.group_id] : null;

        return [
            format(new Date(tx.date), 'yyyy-MM-dd'),
            `"${tx.description.replace(/"/g, '""')}"`,
            tx.category,
            bucket?.name || '',
            group?.name || '',
            tx.payment_method || '-',
            tx.amount,
            tx.currency || 'USD',
            converted.toFixed(2),
            tx.is_recurring ? 'Yes' : 'No'
        ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `expense_report_${format(new Date(), 'yyyyMMdd')}.csv`);
    link.click();
};

const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
        img.src = url;
    });
};

export const generatePDF = async (
    transactions: ExportTransaction[],
    currency: string,
    convertAmount: (amount: number, fromCurrency: string) => number,
    formatCurrency: (amount: number, currency?: string) => string,
    buckets: any[] = [],
    groups: any[] = [],
    reportRange?: DateRange,
    ownerInfo?: { email?: string; avatarUrl?: string | null }
) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    const bucketMap = Object.fromEntries(buckets.map(b => [b.id, b]));
    const groupMap = Object.fromEntries(groups.map(g => [g.id, g]));

    // Sort transactions by date
    const sortedTx = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculations
    const totalSpent = transactions.reduce((acc, tx) => acc + (tx.converted_amount || convertAmount(Number(tx.amount), tx.currency || 'USD')), 0);

    const categoryTotals: Record<string, number> = {};
    const methodTotals: Record<string, number> = {};
    const bucketTotals: Record<string, { spent: number, budget: number }> = {};
    const dailyTotals: Record<string, number> = {};

    transactions.forEach(tx => {
        const amount = tx.converted_amount || convertAmount(Number(tx.amount), tx.currency || 'USD');
        const bucket = tx.bucket_id ? bucketMap[tx.bucket_id] : null;

        categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + amount;
        methodTotals[tx.payment_method || 'Other'] = (methodTotals[tx.payment_method || 'Other'] || 0) + amount;

        if (bucket) {
            // Calculate budget for this bucket
            let effectiveBudget = bucket.budget;

            // If bucket has dates, and report has a range, calculate allocation
            if (bucket.start_date && bucket.end_date && reportRange?.from && reportRange?.to) {
                const bStart = new Date(bucket.start_date);
                const bEnd = new Date(bucket.end_date);
                const rStart = reportRange.from;
                const rEnd = reportRange.to;

                // Calculate overlap
                const overlapStart = new Date(Math.max(bStart.getTime(), rStart.getTime()));
                const overlapEnd = new Date(Math.min(bEnd.getTime(), rEnd.getTime()));

                if (overlapEnd > overlapStart) {
                    // Proportional allocation for the overlapping period
                    const bucketDays = Math.max(1, differenceInDays(bEnd, bStart));
                    const overlapDays = Math.max(1, differenceInDays(overlapEnd, overlapStart) + 1);
                    effectiveBudget = (bucket.budget / bucketDays) * overlapDays;
                } else if (rEnd < bStart) {
                    // Pre-trip phase: use full budget as reference so pre-spending is tracked correctly
                    effectiveBudget = bucket.budget;
                } else {
                    // Post-trip or other: default to total budget
                    effectiveBudget = bucket.budget;
                }
            }

            if (!bucketTotals[bucket.name]) {
                bucketTotals[bucket.name] = { spent: 0, budget: effectiveBudget };
            }
            bucketTotals[bucket.name].spent += amount;
        }

        const dateKey = format(new Date(tx.date), 'MMM d');
        dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + amount;
    });

    const topExpenses = [...transactions]
        .map(tx => ({ ...tx, converted: tx.converted_amount || convertAmount(Number(tx.amount), tx.currency || 'USD') }))
        .sort((a, b) => b.converted - a.converted)
        .slice(0, 5);

    const formatForPDF = (amount: number, cur?: string) => {
        return formatCurrency(amount, cur).replace('₹', 'Rs. ');
    };

    // --- PAGE 1: RECAP & ANALYTICS ---
    doc.setFillColor(138, 43, 226);
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text('Expense Audit Report', 14, 25);

    doc.setFontSize(10);
    doc.text(`Generated on: ${format(new Date(), 'PPP')}`, 14, 32);

    // Header with User Identity
    if (ownerInfo) {
        if (ownerInfo.avatarUrl) {
            try {
                const img = await loadImage(ownerInfo.avatarUrl);
                // Draw avatar without the border circle
                doc.addImage(img, 'JPEG', pageWidth - 28, 10, 14, 14, undefined, 'FAST');
            } catch (e) {
                console.warn('Failed to load avatar for PDF', e);
            }
        }
        doc.setFontSize(9);
        doc.setTextColor(230, 230, 230);
        doc.text(ownerInfo.email || '', pageWidth - 14, 32, { align: 'right' });
    }

    // Summary Boxes
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(12);
    doc.text('Financial Overview', 14, 55);

    doc.setDrawColor(240, 240, 240);
    doc.rect(14, 60, 55, 30); // Total
    doc.rect(79, 60, 55, 30); // Avg Daily
    doc.rect(144, 60, 55, 30); // Transactions

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('TOTAL SPENT', 18, 68);
    doc.text('DAILY AVERAGE', 83, 68);
    doc.text('TRANSACTIONS', 148, 68);

    doc.setFontSize(12);
    doc.setTextColor(138, 43, 226);
    doc.setFont('helvetica', 'bold');
    doc.text(formatForPDF(totalSpent, currency), 18, 80);

    const days = sortedTx.length > 0
        ? Math.max(1, differenceInDays(new Date(sortedTx[sortedTx.length - 1].date), new Date(sortedTx[0].date)) + 1)
        : 1;
    doc.text(formatForPDF(totalSpent / days, currency), 83, 80);
    doc.text(transactions.length.toString(), 148, 80);
    doc.setFont('helvetica', 'normal');

    // Pie Charts Row
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(11);
    doc.text('Category Breakdown', 14, 105);
    doc.text('Payment Methods', 110, 105);

    const pieData = Object.entries(categoryTotals).map(([label, value]) => ({
        label: label.charAt(0).toUpperCase() + label.slice(1),
        value,
        color: getCategoryColor(label)
    })).sort((a, b) => b.value - a.value);

    drawPieChart(doc, pieData, 35, 130, 20);

    const methodData = Object.entries(methodTotals).map(([label, value]) => ({
        label: label.charAt(0).toUpperCase() + label.slice(1),
        value,
        color: getMethodColor(label)
    })).sort((a, b) => b.value - a.value);

    drawPieChart(doc, methodData, 130, 130, 20);

    // Bar Chart & Top Expenses Row
    doc.setFontSize(11);
    doc.text('Spending Trend', 14, 185);
    const barData = Object.entries(dailyTotals).map(([label, value]) => ({ label, value })).slice(-7);
    drawBarChart(doc, barData, 14, 195, 80, 40, [138, 43, 226]);

    doc.text('Top 5 Expenses', 110, 185);
    topExpenses.forEach((tx, i) => {
        const y = 195 + (i * 9);
        doc.setFontSize(8);
        doc.setTextColor(80, 80, 80);

        const description = tx.is_recurring
            ? `${tx.description} (Rec)`
            : tx.description;

        doc.text(description.length > 25 ? description.substring(0, 23) + '..' : description, 110, y);
        doc.setTextColor(138, 43, 226);
        doc.text(formatForPDF(tx.converted, currency), pageWidth - 14, y, { align: 'right' });
        doc.setDrawColor(245, 245, 245);
        doc.line(110, y + 2, pageWidth - 14, y + 2);
    });

    // --- PAGE 2: BUCKETS & DETAILED LIST ---
    doc.addPage();

    doc.setTextColor(50, 50, 50);
    doc.setFontSize(14);
    doc.text('Bucket Performance', 14, 20);

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('Comparing your actual spending against the budgets set for each bucket.', 14, 26);

    let bucketY = 40;
    const bucketEntries = Object.entries(bucketTotals);
    if (bucketEntries.length === 0) {
        doc.setFontSize(10);
        doc.setTextColor(150, 150, 150);
        doc.text('No buckets associated with these transactions.', 14, bucketY);
        bucketY += 10;
    } else {
        bucketEntries.forEach(([name, data]) => {
            if (bucketY > 260) { doc.addPage(); bucketY = 20; }
            const hasBudget = data.budget > 0;
            const percent = hasBudget ? (data.spent / data.budget) * 100 : 0;

            doc.setFontSize(10);
            doc.setTextColor(50, 50, 50);
            doc.text(name, 14, bucketY);

            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            const budgetText = hasBudget ? formatForPDF(data.budget, currency) : 'No Budget Set';
            doc.text(`${formatForPDF(data.spent, currency)} / ${budgetText}`, pageWidth - 14, bucketY, { align: 'right' });

            const progressColor = !hasBudget ? [200, 200, 200] : (percent > 100 ? [255, 107, 107] : [74, 222, 128]);
            drawProgressBar(doc, hasBudget ? percent : 100, 14, bucketY + 3, pageWidth - 28, 4, progressColor as [number, number, number]);

            if (hasBudget && percent > 100) {
                doc.setTextColor(255, 107, 107);
                doc.setFontSize(7);
                doc.text(`Over budget by ${formatForPDF(data.spent - data.budget, currency)}!`, 14, bucketY + 10);
            }

            bucketY += hasBudget && percent > 100 ? 20 : 15;
        });
    }

    // Detailed Table
    doc.setFontSize(14);
    doc.setTextColor(50, 50, 50);
    doc.text('Transaction Details', 14, bucketY + 10);

    const tableColumn = ["Date", "Description", "Category", "Payment", "Group", "Rec", "Amount"];
    const tableRows = sortedTx.map(tx => {
        const group = tx.group_id ? groupMap[tx.group_id] : null;

        return [
            format(new Date(tx.date), 'MMM d, yy'),
            tx.description.length > 25 ? tx.description.substring(0, 23) + '..' : tx.description,
            tx.category,
            tx.payment_method || '-',
            group?.name || '-',
            tx.is_recurring ? 'Yes' : 'No',
            formatForPDF(tx.converted_amount || convertAmount(Number(tx.amount), tx.currency || 'USD'), currency)
        ]
    });

    autoTable(doc as any, {
        head: [tableColumn],
        body: tableRows,
        startY: bucketY + 15,
        theme: 'striped',
        headStyles: { fillColor: [138, 43, 226], textColor: [255, 255, 255] },
        styles: { fontSize: 8, cellPadding: 2 },
        margin: { top: 20 },
    });

    doc.save(`novira_financial_audit_${format(new Date(), 'yyyyMMdd')}.pdf`);
};
