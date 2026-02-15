import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

// Define Transaction type locally if not available globally, or import it. 
// For utils, it's often safer to define the expected interface.
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
}

export const generateCSV = (
    transactions: ExportTransaction[],
    currency: string,
    convertAmount: (amount: number, fromCurrency: string) => number,
    formatCurrency: (amount: number, currency?: string) => string
) => {
    // CSV Header
    const headers = [
        'Date',
        'Description',
        'Category',
        'Payment Method',
        'Original Amount',
        'Original Currency',
        'Exchange Rate',
        'Converted Amount',
        'Base Currency'
    ];

    // CSV Rows
    const rows = transactions.map(tx => {
        let convertedAmount = 0;
        let exchangeRate = 0;
        let baseCurrency = currency; // Default to current profile currency if not stored

        // Use stored values if available and matching base currency
        if (tx.converted_amount && tx.base_currency === currency) {
            convertedAmount = Number(tx.converted_amount);
            exchangeRate = Number(tx.exchange_rate) || 0;
            baseCurrency = tx.base_currency;
        } else {
            // Fallback to real-time
            convertedAmount = convertAmount(Number(tx.amount), tx.currency || 'USD');
            // Estimate rate
            exchangeRate = Number(tx.amount) !== 0 ? convertedAmount / Number(tx.amount) : 0;
        }

        return [
            format(new Date(tx.date), 'yyyy-MM-dd'),
            `"${tx.description.replace(/"/g, '""')}"`, // Escape quotes
            tx.category,
            tx.payment_method,
            tx.amount,
            tx.currency || 'USD',
            exchangeRate.toFixed(4),
            convertedAmount.toFixed(2),
            baseCurrency
        ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `expense_report_${format(new Date(), 'yyyyMMdd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const generatePDF = (
    transactions: ExportTransaction[],
    currency: string,
    convertAmount: (amount: number, fromCurrency: string) => number,
    formatCurrency: (amount: number, currency?: string) => string
) => {
    const doc = new jsPDF();
    const totalSpent = transactions.reduce((acc, tx) => acc + convertAmount(Number(tx.amount), tx.currency || 'USD'), 0);

    // Helper to sanitize currency for PDF (custom fonts not supported)
    const formatForPDF = (amount: number, currency?: string) => {
        return formatCurrency(amount, currency).replace('₹', 'Rs. ');
    };

    // Title
    doc.setFontSize(20);
    doc.text('Expense Report', 14, 22);

    // Meta Info
    doc.setFontSize(10);
    doc.text(`Generated on: ${format(new Date(), 'PPP')}`, 14, 30);
    doc.text(`Total Spent: ${formatForPDF(totalSpent, currency)}`, 14, 35);

    // Table
    const tableColumn = ["Date", "Description", "Category", "Amount", "Rate", "Converted"];
    const tableRows = transactions.map(tx => {
        let converted = 0;
        let rate = 0;

        // Use stored values if available and matching base currency
        if (tx.converted_amount && tx.base_currency === currency) {
            converted = Number(tx.converted_amount);
            rate = Number(tx.exchange_rate) || 0;
        } else {
            // Fallback to real-time
            converted = convertAmount(Number(tx.amount), tx.currency || 'USD');
            // Estimate rate
            rate = Number(tx.amount) !== 0 ? converted / Number(tx.amount) : 0;
        }

        // Only show rate if currencies differ
        const rateStr = (tx.currency || 'USD') !== currency ? rate.toFixed(2) : '-';

        return [
            format(new Date(tx.date), 'MMM d, yyyy'),
            tx.description,
            tx.category,
            formatForPDF(Number(tx.amount), tx.currency), // Original
            rateStr,
            formatForPDF(converted, currency) // Converted
        ];
    });

    autoTable(doc as any, {
        head: [tableColumn],
        body: tableRows,
        foot: [['Total', '', '', '', formatForPDF(totalSpent, currency)]],
        startY: 40,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [138, 43, 226], textColor: [255, 255, 255] }, // Electric Purple
        footStyles: { fillColor: [138, 43, 226], textColor: [255, 255, 255], fontStyle: 'bold' }, // Match header
        alternateRowStyles: { fillColor: [245, 245, 245] },
    });

    doc.save(`expense_report_${format(new Date(), 'yyyyMMdd')}.pdf`);
};
