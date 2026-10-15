import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { format } from 'date-fns';
import * as Print from 'expo-print';
import { Asset } from 'expo-asset';
import { FINFIT_LOGO_BASE64 } from './logoBase64';

export const exportService = {
  async exportToJSON(transactions) {
    try {
      const txList = Array.isArray(transactions) ? transactions : [];
      if (txList.length === 0) {
        throw new Error('No transactions found to export.');
      }
      const jsonContent = JSON.stringify(txList, null, 2);
      const fileName = `FinFit_expenses_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.json`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;
      
      await FileSystem.writeAsStringAsync(filePath, jsonContent);
      await shareFile(filePath, 'FinFit Expenses JSON');
    } catch (error) {
      console.error('Error exporting to JSON:', error);
      throw error;
    }
  },

  async exportToCSV(transactions) {
    try {
      const txList = Array.isArray(transactions) ? transactions : [];
      if (txList.length === 0) {
        throw new Error('No transactions found to export.');
      }
      const headers = ['Date', 'Type', 'Category', 'Amount', 'Account', 'Note'];
      const rows = txList.map(t => {
        let dateStr = '';
        try {
          if (t.date) dateStr = format(new Date(t.date), 'yyyy-MM-dd HH:mm:ss');
        } catch (e) {
          dateStr = String(t.date || '');
        }
        return [
          dateStr,
          t.type || 'EXPENSE',
          t.category || 'General',
          (parseFloat(t.amount || 0)).toString(),
          t.account || '',
          t.note || ''
        ];
      });
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
      ].join('\n');
      
      const fileName = `FinFit_expenses_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;
      
      await FileSystem.writeAsStringAsync(filePath, csvContent);
      await shareFile(filePath, 'FinFit Expenses CSV');
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      throw error;
    }
  },

  async exportToPDF(transactions) {
    try {
      const txList = Array.isArray(transactions) ? transactions : [];
      if (txList.length === 0) {
        throw new Error('No transactions found to export.');
      }
      const groupedTransactions = groupTransactionsByMonth(txList);
      const htmlContent = await generatePDFContent(groupedTransactions);
  
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false
      });

      const fileName = `FinFit_Expense_Report.pdf`;
      const targetFilePath = `${FileSystem.documentDirectory}${fileName}`;

      let fileToShare = uri;
      try {
        const fileInfo = await FileSystem.getInfoAsync(targetFilePath);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(targetFilePath, { idempotent: true });
        }
        await FileSystem.copyAsync({
          from: uri,
          to: targetFilePath,
        });
        fileToShare = targetFilePath;
      } catch (copyErr) {
        console.warn('Copying to target path failed, falling back to temp uri:', copyErr?.message);
        fileToShare = uri;
      }
  
      await shareFile(fileToShare, 'FinFit Expense Report');
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      throw error;
    }
  }
};

const shareFile = async (filePath, dialogTitle = 'Share File') => {
  try {
    const isAvailable = await Sharing.isAvailableAsync().catch(() => false);
    if (!isAvailable) {
      // Fallback: If sharing intent is unavailable, open system print/save-as-pdf dialog
      await Print.printAsync({ uri: filePath });
      return;
    }
    await Sharing.shareAsync(filePath, {
      mimeType: filePath.endsWith('.pdf') ? 'application/pdf' : undefined,
      dialogTitle: dialogTitle,
      UTI: filePath.endsWith('.pdf') ? 'com.adobe.pdf' : undefined,
    });
  } catch (shareErr) {
    console.warn('Sharing error, attempting system print fallback:', shareErr?.message);
    if (filePath.endsWith('.pdf')) {
      await Print.printAsync({ uri: filePath });
    } else {
      throw shareErr;
    }
  }
};

const groupTransactionsByMonth = (transactions) => {
  return (transactions || []).reduce((groups, transaction) => {
    let monthYear = 'All Transactions';
    try {
      if (transaction.date) {
        monthYear = format(new Date(transaction.date), 'MMMM yyyy');
      }
    } catch (e) {
      monthYear = 'All Transactions';
    }
    
    if (!groups[monthYear]) {
      groups[monthYear] = [];
    }
    groups[monthYear].push(transaction);
    return groups;
  }, {});
};

const generatePDFContent = async (groupedTransactions) => {
  // Ensure FinFit logo is always loaded reliably
  let appLogoUri = FINFIT_LOGO_BASE64;
  try {
    const appLogoAsset = Asset.fromModule(require('../assets/images/logoBlack.png'));
    await appLogoAsset.downloadAsync();
    const uri = appLogoAsset.localUri || appLogoAsset.uri;
    if (uri && (uri.startsWith('file://') || uri.startsWith('/'))) {
      const b64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (b64) appLogoUri = `data:image/png;base64,${b64}`;
    }
  } catch (err) {
    // If dynamic asset loading encounters an issue, fallback to embedded FINFIT_LOGO_BASE64
    appLogoUri = FINFIT_LOGO_BASE64;
  }

  const monthSections = Object.entries(groupedTransactions)
    .map(([month, transactions]) => {
      const rows = (transactions || [])
        .map(t => {
          const amt = parseFloat(t.amount || 0);
          const typeStr = (t.type || 'EXPENSE').toUpperCase();
          const isExpense = typeStr === 'EXPENSE';
          let dateStr = 'N/A';
          try {
            if (t.date) dateStr = format(new Date(t.date), 'MMM dd, yyyy');
          } catch (e) {}

          return `
            <tr>
              <td>${dateStr}</td>
              <td>${t.category || 'General'}</td>
              <td><span class="badge ${isExpense ? 'badge-expense' : 'badge-income'}">${typeStr}</span></td>
              <td style="text-align: right; font-weight: 600; color: ${isExpense ? '#d32f2f' : '#2e7d32'}">₹${amt.toFixed(2)}</td>
              <td>${t.account || 'Default'}</td>
              <td>${t.note || ''}</td>
            </tr>
          `;
        })
        .join('');

      const monthlyExpense = (transactions || []).reduce((sum, t) => {
        const amt = parseFloat(t.amount || 0);
        return (t.type || '').toUpperCase() === 'EXPENSE' || !t.type ? sum + amt : sum;
      }, 0);

      const monthlyIncome = (transactions || []).reduce((sum, t) => {
        const amt = parseFloat(t.amount || 0);
        return (t.type || '').toUpperCase() === 'INCOME' ? sum + amt : sum;
      }, 0);

      const monthlyNet = monthlyIncome - monthlyExpense;

      return `
        <div class="month-section">
          <h2>${month}</h2>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Type</th>
                <th style="text-align: right">Amount</th>
                <th>Account</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="3" style="font-weight: 600;">Monthly Summary</td>
                <td style="text-align: right; font-weight: 700; color: ${monthlyNet >= 0 ? '#2e7d32' : '#d32f2f'}">
                  Net: ₹${monthlyNet.toFixed(2)} (Spent: ₹${monthlyExpense.toFixed(2)})
                </td>
                <td colspan="2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>FinFit Expense Report</title>
        <style>
          * { box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
            padding: 24px; 
            color: #1a1a1a;
            background-color: #ffffff;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 16px;
            border-bottom: 2px solid #e0e0e0;
            margin-bottom: 24px;
          }
          .brand-logo { max-height: 48px; max-width: 160px; object-fit: contain; }
          .report-badge {
            display: inline-block;
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            background-color: #f0fdf4;
            color: #166534;
            border: 1px solid #bbf7d0;
          }
          .report-title {
            text-align: center;
            font-size: 24px;
            font-weight: 800;
            color: #111;
            margin: 0 0 4px 0;
          }
          .report-subtitle {
            text-align: center;
            font-size: 13px;
            color: #666;
            margin: 0 0 24px 0;
          }
          .month-section { 
            margin-bottom: 28px; 
            page-break-inside: avoid;
          }
          h2 { 
            color: #222; 
            font-size: 17px;
            font-weight: 700;
            border-bottom: 2px solid #edfD9a; 
            padding-bottom: 6px;
            margin-bottom: 12px;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            font-size: 12px;
          }
          th, td { 
            padding: 9px 10px; 
            border-bottom: 1px solid #e8e8e8; 
            text-align: left;
          }
          th { 
            background-color: #f8f9fa; 
            color: #495057;
            font-weight: 700;
            border-top: 1px solid #dee2e6;
          }
          tfoot tr td {
            background-color: #fbfbfb;
            border-top: 2px solid #dee2e6;
            padding: 10px;
          }
          .badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: 700;
          }
          .badge-expense {
            background-color: #ffebee;
            color: #c62828;
          }
          .badge-income {
            background-color: #e8f5e9;
            color: #2e7d32;
          }
          .footer-note {
            text-align: center;
            font-size: 11px;
            color: #888;
            margin-top: 32px;
            border-top: 1px dashed #ddd;
            padding-top: 12px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <img class="brand-logo" src="${appLogoUri}" alt="FinFit" />
          </div>
          <div class="header-right">
            <span class="report-badge">Expense Report</span>
          </div>
        </div>

        <h1 class="report-title">FinFit Expense Report</h1>
        <p class="report-subtitle">Generated on ${format(new Date(), 'MMMM dd, yyyy • hh:mm a')}</p>

        ${monthSections}

        <div class="footer-note">
          Generated automatically by FinFit
        </div>
      </body>
    </html>
  `;
};