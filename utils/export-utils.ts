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
        `Amount (${currency})`
    ];

    // CSV Rows
    const rows = transactions.map(tx => {
        const convertedAmount = convertAmount(Number(tx.amount), tx.currency || 'USD');
        return [
            format(new Date(tx.date), 'yyyy-MM-dd'),
            `"${tx.description.replace(/"/g, '""')}"`, // Escape quotes
            tx.category,
            tx.payment_method,
            tx.amount,
            tx.currency || 'USD',
            convertedAmount.toFixed(2)
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
    const tableColumn = ["Date", "Description", "Category", "Amount", "Converted"];
    const tableRows = transactions.map(tx => {
        const converted = convertAmount(Number(tx.amount), tx.currency || 'USD');
        return [
            format(new Date(tx.date), 'MMM d, yyyy'),
            tx.description,
            tx.category,
            formatForPDF(Number(tx.amount), tx.currency), // Original
            formatForPDF(converted, currency) // Converted
        ];
    });

    autoTable(doc, {
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
