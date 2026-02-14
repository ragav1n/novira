declare module 'jspdf-autotable' {
    import { jsPDF } from 'jspdf';

    export interface AutoTableOptions {
        head?: any[][];
        body?: any[][];
        foot?: any[][];
        theme?: 'striped' | 'grid' | 'plain';
        styles?: any;
        headStyles?: any;
        bodyStyles?: any;
        footStyles?: any;
        alternateRowStyles?: any;
        startY?: number;
        margin?: any;
        pageBreak?: 'auto' | 'avoid' | 'always';
        rowPageBreak?: 'auto' | 'avoid';
        tableWidth?: 'auto' | 'wrap' | number;
        showHead?: 'everyPage' | 'firstPage' | 'never';
        showFoot?: 'everyPage' | 'lastPage' | 'never';
        tableLineWidth?: number;
        tableLineColor?: any;
        columnStyles?: any;
    }

    export default function autoTable(doc: jsPDF, options: AutoTableOptions): void;
}
