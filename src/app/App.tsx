import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Calendar, Download, Plus, Edit, Trash2, Filter, Loader2, Upload, LogOut, User, Search, ArrowUpDown, ArrowUp, ArrowDown, X, History, Clock, ScanLine } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './components/LoginPage';
import BarcodeScanner from './components/BarcodeScanner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './components/ui/dialog';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Checkbox } from './components/ui/checkbox';
import { Button } from './components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from './components/ui/popover';
// import { Dialog, ... } removed
import { Calendar as CalendarComponent } from './components/ui/calendar';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import * as XLSX from 'xlsx';
import { maintenanceAPI, HistoryLog } from '../utils/api';
import { toast, Toaster } from 'sonner';


// ============================================================================
// GLOBAL ERROR SUPPRESSION - MUST BE AT TOP LEVEL (EXECUTES IMMEDIATELY)
// ============================================================================
(function suppressFetchErrors() {
  // Suppress console errors
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const errorString = args.join(' ').toLowerCase();
    if (
      errorString.includes('failed to fetch') ||
      errorString.includes('networkerror') ||
      errorString.includes('fetch error') ||
      errorString.includes('aborterror') ||
      errorString.includes('typeerror: failed')
    ) {
      return; // Silently ignore
    }
    originalConsoleError.apply(console, args);
  };

  // Suppress window errors
  window.addEventListener('error', (event: ErrorEvent) => {
    const errorMessage = event.message?.toLowerCase() || '';
    if (
      errorMessage.includes('failed to fetch') ||
      errorMessage.includes('networkerror') ||
      errorMessage.includes('fetch')
    ) {
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
  });

  // Suppress unhandled promise rejections - MOST IMPORTANT!
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason?.toString()?.toLowerCase() || '';
    const message = event.reason?.message?.toLowerCase() || '';

    if (
      reason.includes('failed to fetch') ||
      reason.includes('networkerror') ||
      reason.includes('fetch') ||
      message.includes('failed to fetch') ||
      message.includes('networkerror') ||
      message.includes('fetch')
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
  });
})();
// ============================================================================

interface MaintenanceRecord {
  id: string;
  no: number;
  partNo: string;
  serial: string;
  type: 'FULL-ATLAS' | 'HALF-ATLAS' | 'FULL-REKONDISI' | 'HALF-REKONDISI';
  atlas: string;
  remarks: {
    lockPart: boolean;
    brakeSystem: boolean;
    bodyPart: boolean;
    swivelSingle: boolean;
    magnetRusak: boolean;
    magnetBaru: boolean;
    rodaRusak: boolean;
    rodaBaru: boolean;
    stikerBarcode: boolean;
    uttReck: boolean;
  };
  from: string;
  delivery: string;
  input: 'IN' | 'OUT' | 'REP' | 'COD';
  posisi: string;
  remarkText: string;
  remarksBarcode: string;
  status: 'SERVICEABLE' | 'UNSERVICEABLE';
  date: string;
  po: string;
  createdAt: string;
}

export default function App() {
  const [date, setDate] = useState<Date>(new Date());
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<MaintenanceRecord[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState(''); // Added search state
  const [filterStartDate, setFilterStartDate] = useState<Date | null>(null);
  const [filterEndDate, setFilterEndDate] = useState<Date | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [activeTab, setActiveTab] = useState('form');
  const [importProgress, setImportProgress] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [useFilter, setUseFilter] = useState(false); // Toggle untuk filter tanggal

  // Dashboard states
  const [typeStatusFilter, setTypeStatusFilter] = useState<'ALL' | 'SERVICEABLE' | 'UNSERVICEABLE'>('ALL'); // Filter Type Distribution by status
  const [inputYear, setInputYear] = useState<number>(new Date().getFullYear()); // Year filter for Input Type Distribution
  const [inputMonth, setInputMonth] = useState<string>('ALL'); // Month filter: 'ALL' or '0'-'11'


  // History Log State
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historySerial, setHistorySerial] = useState('');
  const [historyLogs, setHistoryLogs] = useState<HistoryLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Advanced Filters State
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterInput, setFilterInput] = useState<string>('ALL');
  const [filterFrom, setFilterFrom] = useState<string>('');
  const [filterDelivery, setFilterDelivery] = useState<string>('');
  const [filterRemarks, setFilterRemarks] = useState<string>('ALL'); // 'ALL' | 'HAS_REMARKS' | 'NO_REMARKS'
  const [filterDamageCategory, setFilterDamageCategory] = useState<string>('ALL');
  const [filterNewParts, setFilterNewParts] = useState<string>('ALL');

  // Barcode Scanner States
  const [formBarcodeScannerOpen, setFormBarcodeScannerOpen] = useState(false);
  const [searchBarcodeScannerOpen, setSearchBarcodeScannerOpen] = useState(false);

  const [customPartNo, setCustomPartNo] = useState('');

  const [formData, setFormData] = useState({
    partNo: '',
    serial: '',
    type: 'FULL-ATLAS' as 'FULL-ATLAS' | 'HALF-ATLAS' | 'FULL-REKONDISI' | 'HALF-REKONDISI',
    atlas: '',
    from: '',
    delivery: '',
    input: 'IN' as 'IN' | 'OUT' | 'REP' | 'COD',
    posisi: '',
    remarkText: '',
    remarksBarcode: '',
    status: 'SERVICEABLE' as 'SERVICEABLE' | 'UNSERVICEABLE',
    po: '',
    remarks: {
      lockPart: false,
      brakeSystem: false,
      bodyPart: false,
      swivelSingle: false,
      magnetRusak: false,
      magnetBaru: false,
      rodaRusak: false,
      rodaBaru: false,
      stikerBarcode: false,
      uttReck: false,
    },
  });

  // Load all records on mount
  useEffect(() => {
    checkServerAndLoadRecords();

    return () => {
      // Cleanup if needed
    };
  }, []);

  // Filter records when date range changes
  // useEffect removed - handled by combined filter effect

  const checkServerAndLoadRecords = async () => {
    try {
      setLoading(true);

      // ========================================================================
      // FULL ONLINE MODE - Check server connection
      // ========================================================================
      const isServerHealthy = await maintenanceAPI.healthCheck();

      if (isServerHealthy) {
        toast.success('🌐 Terhubung ke MySQL Database (Localhost)!', {
          duration: 3000,
        });
        setIsUsingFallback(false);
      } else {
        toast.error('❌ Server MySQL tidak tersedia! Pastikan Laragon sudah berjalan.', {
          duration: 10000,
        });
        setIsUsingFallback(true);
        setRecords([]);
        return;
      }

      // Load records
      await loadRecords();
    } catch (error) {
      console.error('Error during initialization:', error);
      toast.error('Error saat inisialisasi aplikasi');
      setIsUsingFallback(true);
    } finally {
      setLoading(false);
    }
  };

  const loadRecords = async () => {
    try {
      setLoading(true);

      const isUsingFallback = maintenanceAPI.isUsingFallback();
      setIsUsingFallback(isUsingFallback);

      if (isUsingFallback) {
        toast.info('Mode Offline: Data disimpan di browser Anda.', {
          duration: 3000,
        });
      }

      const data = await maintenanceAPI.getAll();
      setRecords(data);

      if (data.length === 0) {
        toast.info('Belum ada data. Silakan tambahkan data baru atau import Excel.');
      }
    } catch (error) {
      console.error('Error loading records:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Error loading records: ${errorMessage}`);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter records based on active filters and search term
  useEffect(() => {
    let result = records;

    // Date Filter
    if (useFilter) {
      result = result.filter((record) => {
        const recordDate = new Date(record.date);
        if (filterStartDate && filterEndDate) {
          return recordDate >= filterStartDate && recordDate <= filterEndDate;
        } else if (filterStartDate) {
          return recordDate >= filterStartDate;
        } else if (filterEndDate) {
          return recordDate <= filterEndDate;
        }
        return true;
      });
    }

    // Search Filter
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter((record) =>
        record.partNo.toLowerCase().includes(lowerSearch) ||
        record.serial.toLowerCase().includes(lowerSearch) ||
        record.status.toLowerCase().includes(lowerSearch) ||
        record.type.toLowerCase().includes(lowerSearch)
      );
    }

    // Advanced Filters
    if (filterStatus !== 'ALL') {
      result = result.filter(r => {
        const derivedStatus = (r.remarks.bodyPart || r.remarks.brakeSystem || r.remarks.magnetRusak || r.remarks.rodaRusak || r.remarks.lockPart) ? 'UNSERVICEABLE' : 'SERVICEABLE';
        return derivedStatus === filterStatus;
      });
    }

    if (filterType !== 'ALL') {
      result = result.filter(r => r.type === filterType);
    }

    if (filterInput !== 'ALL') {
      result = result.filter(r => r.input === filterInput);
    }

    if (filterFrom) {
      result = result.filter(r => r.from.toLowerCase().includes(filterFrom.toLowerCase()));
    }


    if (filterDamageCategory !== 'ALL') {
      result = result.filter(r => {
        const key = filterDamageCategory as keyof typeof r.remarks;
        return r.remarks[key] === true;
      });
    }

    // New Parts Filter (N.M, N.WS, N.BR)
    if (filterNewParts !== 'ALL') {
      result = result.filter(r => {
        const key = filterNewParts as keyof typeof r.remarks;
        return r.remarks[key] === true;
      });
    }

    setFilteredRecords(result);
  }, [records, useFilter, filterStartDate, filterEndDate, searchTerm, filterStatus, filterType, filterInput, filterFrom, filterDamageCategory, filterNewParts]);

  // Sort state
  const [sortColumn, setSortColumn] = useState<string>('no');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (column: string) => {
    if (sortColumn !== column) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  // Derived state for display with sorting
  const displayRecords = useMemo(() => {
    const sorted = [...filteredRecords].sort((a, b) => {
      let valA: any, valB: any;
      switch (sortColumn) {
        case 'no': valA = a.no; valB = b.no; break;
        case 'partNo': valA = a.partNo; valB = b.partNo; break;
        case 'serial': valA = a.serial; valB = b.serial; break;
        case 'type': valA = a.type; valB = b.type; break;
        case 'from': valA = a.from; valB = b.from; break;
        case 'status': valA = a.status; valB = b.status; break;
        case 'date': valA = new Date(a.date).getTime(); valB = new Date(b.date).getTime(); break;
        default: valA = a.no; valB = b.no;
      }
      if (typeof valA === 'string') {
        const cmp = valA.localeCompare(valB);
        return sortDirection === 'asc' ? cmp : -cmp;
      }
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });
    return sorted;
  }, [filteredRecords, sortColumn, sortDirection]);

  // Ref for virtualized table container
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Virtualizer for large data sets - only renders visible rows
  const rowVirtualizer = useVirtualizer({
    count: displayRecords.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 48, // Estimated row height in pixels
    overscan: 10, // Number of rows to render above/below visible area
  });

  // Memoize analytics data to prevent recalculation on every render
  // Single-pass counting for maximum performance with large datasets
  const analyticsData = useMemo(() => {
    let fullAtlasCount = 0, halfAtlasCount = 0, fullRekCount = 0, halfRekCount = 0;
    let fullAtlasSvc = 0, fullAtlasUnsvc = 0, halfAtlasSvc = 0, halfAtlasUnsvc = 0;
    let fullRekSvc = 0, fullRekUnsvc = 0, halfRekSvc = 0, halfRekUnsvc = 0;
    let okCount = 0, rusakCount = 0;
    let inCount = 0, outCount = 0, repCount = 0;
    let bpCount = 0, brCount = 0, mCount = 0, wsCount = 0, lpCount = 0;
    let nmCount = 0, nwsCount = 0, nbrCount = 0;

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const unsvc = r.remarks.bodyPart || r.remarks.brakeSystem || r.remarks.magnetRusak || r.remarks.rodaRusak || r.remarks.lockPart;

      // Type
      if (r.type === 'FULL-ATLAS') {
        fullAtlasCount++;
        if (unsvc) fullAtlasUnsvc++; else fullAtlasSvc++;
      } else if (r.type === 'HALF-ATLAS') {
        halfAtlasCount++;
        if (unsvc) halfAtlasUnsvc++; else halfAtlasSvc++;
      } else if (r.type === 'FULL-REKONDISI') {
        fullRekCount++;
        if (unsvc) fullRekUnsvc++; else fullRekSvc++;
      } else if (r.type === 'HALF-REKONDISI') {
        halfRekCount++;
        if (unsvc) halfRekUnsvc++; else halfRekSvc++;
      }

      // Status
      if (unsvc) rusakCount++; else okCount++;

      // Input
      if (r.input === 'IN') inCount++;
      else if (r.input === 'OUT') outCount++;
      else if (r.input === 'REP') repCount++;

      // Remarks
      if (r.remarks.bodyPart) bpCount++;
      if (r.remarks.brakeSystem) brCount++;
      if (r.remarks.magnetRusak) mCount++;
      if (r.remarks.rodaRusak) wsCount++;
      if (r.remarks.lockPart) lpCount++;

      // New Parts
      if (r.remarks.magnetBaru) nmCount++;
      if (r.remarks.rodaBaru) nwsCount++;
      if (r.remarks.stikerBarcode) nbrCount++;
    }

    return {
      typeData: [
        { name: 'FULL-ATLAS', value: fullAtlasCount },
        { name: 'HALF-ATLAS', value: halfAtlasCount },
        { name: 'FULL-REK', value: fullRekCount },
        { name: 'HALF-REK', value: halfRekCount },
      ],
      typeBreakdownData: [
        { name: 'F-ATLAS', serviceable: fullAtlasSvc, unserviceable: fullAtlasUnsvc },
        { name: 'H-ATLAS', serviceable: halfAtlasSvc, unserviceable: halfAtlasUnsvc },
        { name: 'F-REK', serviceable: fullRekSvc, unserviceable: fullRekUnsvc },
        { name: 'H-REK', serviceable: halfRekSvc, unserviceable: halfRekUnsvc },
      ],
      statusData: [
        { name: 'OK', value: okCount },
        { name: 'RUSAK', value: rusakCount },
      ],
      inputData: [
        { name: 'IN', value: inCount },
        { name: 'OUT', value: outCount },
        { name: 'REP', value: repCount },
        { name: 'COD', value: records.length },
      ],
      remarksData: [
        { name: 'BP (Body Part)', value: bpCount },
        { name: 'BR (Brake)', value: brCount },
        { name: 'M (Magnet)', value: mCount },
        { name: 'WS (Wheels)', value: wsCount },
        { name: 'LP (Lock Part)', value: lpCount },
      ],
      newPartsData: [
        { name: 'N.M (New Magnet)', value: nmCount },
        { name: 'N.WS (New Wheels)', value: nwsCount },
        { name: 'N.BR (New Brake)', value: nbrCount },
      ],
    };
  }, [records]);

  // Get available years from records for the year filter dropdown
  const availableYears = useMemo(() => {
    const yearSet = new Set<number>();
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      let d = new Date(r.date);
      if (isNaN(d.getTime()) || d.getTime() <= 0) d = new Date(r.createdAt);
      if (isNaN(d.getTime()) || d.getTime() <= 0) d = new Date();
      yearSet.add(d.getFullYear());
    }
    return Array.from(yearSet).sort((a, b) => a - b);
  }, [records]);

  // Compute Input Type Distribution — actual monthly data filtered by year & month
  const inputMonthlyData = useMemo(() => {
    if (records.length === 0) return [];

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

    // Parse date robustly
    const parseDate = (r: { date: string; createdAt: string }) => {
      let d = new Date(r.date);
      if (isNaN(d.getTime()) || d.getTime() <= 0) d = new Date(r.createdAt);
      if (isNaN(d.getTime()) || d.getTime() <= 0) d = new Date();
      return d;
    };

    // If a specific month is selected, show only that month
    if (inputMonth !== 'ALL') {
      const selectedMonth = parseInt(inputMonth);
      let inCount = 0, outCount = 0, repCount = 0, codCount = 0;

      for (let i = 0; i < records.length; i++) {
        const d = parseDate(records[i]);
        if (d.getFullYear() === inputYear && d.getMonth() === selectedMonth) {
          if (records[i].input === 'IN') inCount++;
          else if (records[i].input === 'OUT') outCount++;
          else if (records[i].input === 'REP') repCount++;
          codCount++;
        }
      }

      return [{
        name: `${monthNames[selectedMonth]} ${inputYear}`,
        IN: inCount,
        OUT: outCount,
        REP: repCount,
        COD: codCount,
      }];
    }

    // Show all 12 months for the selected year
    const monthBuckets = monthNames.map(() => ({ IN: 0, OUT: 0, REP: 0, COD: 0 }));

    for (let i = 0; i < records.length; i++) {
      const d = parseDate(records[i]);
      if (d.getFullYear() === inputYear) {
        const m = d.getMonth();
        if (records[i].input === 'IN') monthBuckets[m].IN++;
        else if (records[i].input === 'OUT') monthBuckets[m].OUT++;
        else if (records[i].input === 'REP') monthBuckets[m].REP++;
        monthBuckets[m].COD++;
      }
    }

    return monthNames.map((name, idx) => ({
      name,
      IN: monthBuckets[idx].IN,
      OUT: monthBuckets[idx].OUT,
      REP: monthBuckets[idx].REP,
      COD: monthBuckets[idx].COD,
    }));
  }, [records, inputYear, inputMonth]);

  // Gunakan hanya part number bawaan agar dropdown tidak penuh dengan data dari history yang mungkin kotor (salah ketik, dsb)
  const availablePartNumbers = useMemo(() => {
    return ["TK600052", "TL600016", "TL600018", "TK5080001", "TL503001", "TK800004", "CM1001-106GA", "TL060007", "TK075006", "DLH 072-138"];
  }, []);

  const handleCheckboxChange = (key: string) => {
    setFormData((prev) => ({
      ...prev,
      remarks: {
        ...prev.remarks,
        [key]: !prev.remarks[key as keyof typeof prev.remarks],
      },
    }));
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async () => {
    const finalPartNo = formData.partNo === 'LAINNYA' ? customPartNo : formData.partNo;

    if (!finalPartNo || !formData.serial) {
      toast.error('Part No dan Serial harus diisi!');
      return;
    }

    try {
      setLoading(true);

      const submitData = { ...formData, partNo: finalPartNo };

      if (editingId !== null) {
        // Update existing record (via edit button)
        await maintenanceAPI.update(editingId, {
          ...submitData,
          date: date.toISOString(),
        });
        toast.success('🔄 Update Data — Serial Number "' + formData.serial + '" berhasil diupdate!');
        setEditingId(null);
      } else {
        // Always call create — backend handles duplicate detection
        // Backend returns 201 for new records, 200 for auto-updated duplicates
        const maxNo = records.length > 0 ? Math.max(...records.map(r => r.no)) : 0;
        const result = await maintenanceAPI.create({
          ...submitData,
          no: maxNo + 1,
          date: date.toISOString(),
        });

        if (result.isNew) {
          toast.success('✅ Tambah Data Baru — Serial Number "' + formData.serial + '" berhasil ditambahkan!');
        } else {
          toast.success('🔄 Update Data — Serial Number "' + formData.serial + '" sudah ada, data berhasil diupdate!');
        }
      }

      // Reload records
      await loadRecords();

      // Reset form
      setFormData({
        partNo: '',
        serial: '',
        type: 'FULL-ATLAS',
        atlas: '',
        from: '',
        delivery: '',
        input: 'IN',
        posisi: '',
        remarkText: '',
        remarksBarcode: '',
        status: 'SERVICEABLE',
        po: '',
        remarks: {
          lockPart: false,
          brakeSystem: false,
          bodyPart: false,
          swivelSingle: false,
          magnetRusak: false,
          magnetBaru: false,
          rodaRusak: false,
          rodaBaru: false,
          stikerBarcode: false,
          uttReck: false,
        },
      });
      setCustomPartNo('');
      setDate(new Date());
    } catch (error) {
      console.error('Error saving record:', error);
      // Tampilkan pesan error spesifik dari server jika ada
      const errorMessage = error instanceof Error ? error.message : 'Gagal menyimpan data';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (record: MaintenanceRecord) => {
    const isCustom = !availablePartNumbers.includes(record.partNo);
    
    setFormData({
      partNo: isCustom ? 'LAINNYA' : record.partNo,
      serial: record.serial,
      type: record.type,
      atlas: record.atlas || '',
      from: record.from,
      delivery: record.delivery,
      input: record.input,
      posisi: record.posisi || '',
      remarkText: record.remarkText || '',
      remarksBarcode: record.remarksBarcode || '',
      status: record.status,
      po: record.po || '',
      remarks: { ...record.remarks, uttReck: record.remarks.uttReck || false },
    });
    if (isCustom) {
      setCustomPartNo(record.partNo);
    } else {
      setCustomPartNo('');
    }
    setEditingId(record.id);
    setDate(new Date(record.date));
    // Pindah ke tab Form untuk edit
    setActiveTab('form');
    toast.info('Mode edit aktif. Ubah data dan klik Update Data.');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus data ini?')) {
      return;
    }

    try {
      setLoading(true);
      await maintenanceAPI.delete(id);
      toast.success('Data berhasil dihapus');
      await loadRecords();
    } catch (error) {
      console.error('Error deleting record:', error);
      toast.error('Gagal menghapus data');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm(`⚠️ PERINGATAN!\n\nAnda akan menghapus SEMUA ${records.length} data maintenance trolley!\n\nApakah Anda yakin? Tindakan ini tidak bisa dibatalkan!`)) {
      return;
    }

    // Double confirmation
    if (!confirm('Konfirmasi sekali lagi: Hapus SEMUA data?')) {
      return;
    }

    try {
      setLoading(true);
      toast.info('Menghapus semua data...', { duration: Infinity, id: 'delete-all' });

      await maintenanceAPI.deleteAll();

      toast.dismiss('delete-all');
      toast.success('✅ Semua data berhasil dihapus!');

      await loadRecords();
    } catch (error) {
      console.error('Error deleting all records:', error);
      toast.dismiss('delete-all');
      toast.error('Gagal menghapus semua data');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteByDate = async () => {
    // Show date picker dialog
    const targetDateStr = prompt('Masukkan tanggal yang akan dihapus (format: YYYY-MM-DD)\nContoh: 2025-01-27');

    if (!targetDateStr) {
      return;
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(targetDateStr)) {
      toast.error('Format tanggal tidak valid! Gunakan format YYYY-MM-DD (contoh: 2025-01-27)');
      return;
    }

    // Check if date exists in records
    const targetDate = new Date(targetDateStr);
    targetDate.setHours(0, 0, 0, 0);

    const recordsOnDate = records.filter((record) => {
      const recordDate = new Date(record.date);
      recordDate.setHours(0, 0, 0, 0);
      return recordDate.getTime() === targetDate.getTime();
    });

    if (recordsOnDate.length === 0) {
      toast.error(`Tidak ada data untuk tanggal ${format(targetDate, 'dd/MM/yyyy')}`);
      return;
    }

    // Confirmation
    if (!confirm(`⚠️ PERINGATAN!\n\nAnda akan menghapus ${recordsOnDate.length} data pada tanggal ${format(targetDate, 'dd/MM/yyyy')}!\n\nApakah Anda yakin? Tindakan ini tidak bisa dibatalkan!`)) {
      return;
    }

    try {
      setLoading(true);
      toast.info(`Menghapus data tanggal ${format(targetDate, 'dd/MM/yyyy')}...`, { duration: Infinity, id: 'delete-by-date' });

      const deletedCount = await maintenanceAPI.deleteByDate(targetDateStr);

      toast.dismiss('delete-by-date');
      toast.success(`✅ Berhasil menghapus ${deletedCount} data pada tanggal ${format(targetDate, 'dd/MM/yyyy')}!`);

      await loadRecords();
    } catch (error) {
      console.error('Error deleting records by date:', error);
      toast.dismiss('delete-by-date');
      toast.error('Gagal menghapus data per tanggal');
    } finally {
      setLoading(false);
    }
  };

  // ========================================================================
  // HISTORY LOG HANDLER
  // ========================================================================
  const handleViewHistory = async (serial: string) => {
    setHistorySerial(serial);
    setHistoryDialogOpen(true);
    setHistoryLoading(true);
    try {
      const logs = await maintenanceAPI.getHistoryBySerial(serial);
      setHistoryLogs(logs);
    } catch (error) {
      console.error('Error fetching history:', error);
      toast.error('Gagal memuat history. Pastikan server online dan tabel history sudah dibuat.');
      setHistoryLogs([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // ========================================================================
  // BARCODE SCAN HANDLERS
  // ========================================================================
  const handleFormBarcodeScan = (value: string) => {
    // Check if serial already exists in records
    const existingRecord = records.find(
      (r) => r.serial.toLowerCase() === value.toLowerCase()
    );

    if (existingRecord) {
      // Auto-fill entire form with existing data (like Edit mode)
      const isCustom = !availablePartNumbers.includes(existingRecord.partNo);
      
      setFormData({
        partNo: isCustom ? 'LAINNYA' : existingRecord.partNo,
        serial: existingRecord.serial,
        type: existingRecord.type,
        atlas: existingRecord.atlas || '',
        from: existingRecord.from,
        delivery: existingRecord.delivery,
        input: existingRecord.input,
        posisi: existingRecord.posisi || '',
        remarkText: existingRecord.remarkText || '',
        remarksBarcode: existingRecord.remarksBarcode || '',
        status: existingRecord.status,
        po: existingRecord.po || '',
        remarks: { ...existingRecord.remarks, uttReck: existingRecord.remarks.uttReck || false },
      });
      if (isCustom) {
        setCustomPartNo(existingRecord.partNo);
      } else {
        setCustomPartNo('');
      }
      setEditingId(existingRecord.id);
      setDate(new Date(existingRecord.date));
      toast.success(`📷 Serial Number "${value}" ditemukan! Data telah dimuat ke form untuk di-update.`);
    } else {
      // Serial not found, just fill serial field
      handleInputChange('serial', value);
      toast.info(`📷 Serial Number "${value}" belum ada di database. Silakan lengkapi data baru.`);
    }
  };

  const handleSearchBarcodeScan = (value: string) => {
    // Find the record matching the scanned barcode
    const match = records.find(
      (r) => r.serial.toLowerCase() === value.toLowerCase()
    );
    if (match) {
      setSearchTerm(value);
      setActiveTab('data');
      toast.success(`📷 Serial Number "${value}" ditemukan! Menampilkan data...`);
    } else {
      setSearchTerm(value);
      setActiveTab('data');
      toast.warning(`📷 Serial Number "${value}" tidak ditemukan di database. Hasil scan ditampilkan di kolom pencarian.`);
    }
  };

  // ========================================================================
  // MULTI-SHEET EXCEL EXPORT
  // ========================================================================
  const exportToExcel = async () => {
    // Sort ascending by no (1 → last) before exporting
    const sortedRecords = [...displayRecords].sort((a, b) => a.no - b.no);

    // ====== SHEET 1: Maintenance Trolley (format sama seperti sebelumnya) ======
    const titleRow = ['Ceklist Form Maintenance Trolley', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
    const legendRow = ['BP ( BODY PART )', '', 'BR ( BRAKE )', 'M ( MAGNET )', '', 'WS ( WHEELS )', '', 'LP ( LOCK PART )', '', 'N.M ( NEW MAGNET )', '', '', 'N.WS ( NEW WHEELS )', '', 'N.BR ( NEW BRAKE )', '', '', '', ''];
    const dateRow = ['', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Date :', format(new Date(), 'dd/MM/yyyy'), '', '', ''];
    const headerRow = ['NO', 'PART NUMBER', 'SERIAL NUMBER', 'Full-Atlas', 'Half-Atlas', 'Full-Rekondisi', 'Half-Rekondisi', 'BP', 'WS', 'BR', 'LP', 'M', 'N.M', 'N.WS', 'N.BR', 'FROM', 'DELIVERY', 'In', 'Out', 'Rep', 'Cod', 'Date', 'PO'];

    const dataRows = sortedRecords.map((record) => [
      record.no,
      record.partNo,
      record.serial,
      record.type === 'FULL-ATLAS' ? 'v' : '',
      record.type === 'HALF-ATLAS' ? 'v' : '',
      record.type === 'FULL-REKONDISI' ? 'v' : '',
      record.type === 'HALF-REKONDISI' ? 'v' : '',
      record.remarks.bodyPart,
      record.remarks.rodaRusak,
      record.remarks.brakeSystem,
      record.remarks.lockPart,
      record.remarks.magnetRusak,
      record.remarks.magnetBaru,
      record.remarks.rodaBaru,
      record.remarks.stikerBarcode,
      record.from || '',
      record.delivery || '',
      record.input === 'IN',
      record.input === 'OUT',
      record.input === 'REP',
      true,
      record.date,
      record.po
    ]);

    const ws1 = XLSX.utils.aoa_to_sheet([titleRow, legendRow, dateRow, headerRow, ...dataRows]);
    ws1['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 18 } },
      { s: { r: 1, c: 9 }, e: { r: 1, c: 10 } },
      { s: { r: 1, c: 12 }, e: { r: 1, c: 13 } },
      { s: { r: 1, c: 14 }, e: { r: 1, c: 15 } },
    ];
    ws1['!cols'] = [
      { wch: 5 }, { wch: 15 }, { wch: 15 },
      { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
      { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
      { wch: 8 }, { wch: 8 }, { wch: 8 },
      { wch: 10 }, { wch: 10 },
      { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
    ];

    // ====== SHEET 2: History Log ======
    let historyRows: any[][] = [];
    try {
      toast.info('Mengambil data history untuk export...', { duration: 3000, id: 'export-history' });
      const allHistoryRaw = await maintenanceAPI.getAllHistory(5000);
      // Filter out DELETED history logs from export
      const allHistory = allHistoryRaw.filter(log => log.action !== 'DELETED');
      toast.dismiss('export-history');

      const historyHeader = ['SERIAL NUMBER', 'TANGGAL MAINTENANCE', 'WAKTU INPUT', 'ACTION', 'STATUS', 'TYPE', 'INPUT', 'BP', 'WS', 'BR', 'LP', 'M', 'N.M', 'N.WS', 'N.BR', 'FROM', 'DELIVERY', 'DESKRIPSI', 'CHANGED BY'];
      historyRows = allHistory.map((log) => [
        log.serial,
        log.maintenanceDate ? new Date(log.maintenanceDate).toLocaleDateString('id-ID') : '-',
        log.changedAt ? new Date(log.changedAt).toLocaleString('id-ID') : '-',
        log.action,
        log.status || '-',
        log.type || '-',
        log.inputType || '-',
        log.remarks?.bodyPart ? '✓' : '',
        log.remarks?.rodaRusak ? '✓' : '',
        log.remarks?.brakeSystem ? '✓' : '',
        log.remarks?.lockPart ? '✓' : '',
        log.remarks?.magnetRusak ? '✓' : '',
        log.remarks?.magnetBaru ? '✓' : '',
        log.remarks?.rodaBaru ? '✓' : '',
        log.remarks?.remBaru ? '✓' : '',
        log.fromLocation || '',
        log.delivery || '',
        log.description || '',
        log.changedBy || '-',
      ]);

      historyRows = [historyHeader, ...historyRows];
    } catch (error) {
      console.warn('Could not fetch history for export:', error);
      historyRows = [['History log tidak tersedia. Pastikan tabel trolley_history_logs sudah dibuat di database.']];
    }

    const ws2 = XLSX.utils.aoa_to_sheet(historyRows);
    ws2['!cols'] = [
      { wch: 15 }, { wch: 18 }, { wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 8 }, { wch: 8 },
      { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 5 }, { wch: 5 },
      { wch: 12 }, { wch: 12 }, { wch: 40 }, { wch: 12 },
    ];

    // ====== SHEET 3: Summary (Dashboard Representation) ======
    const summaryRows: any[][] = [];

    // Title
    summaryRows.push(['DASHBOARD SUMMARY REPORT', '']);
    summaryRows.push(['Tanggal Generate:', format(new Date(), 'dd/MM/yyyy')]);
    summaryRows.push(['', '']);

    // Overall Stats
    summaryRows.push(['OVERALL METRICS', 'JUMLAH']);
    summaryRows.push(['Total Trolleys', records.length]);
    summaryRows.push(['Serviceable (OK)', analyticsData.statusData.find(d => d.name === 'OK')?.value || 0]);
    summaryRows.push(['Unserviceable (Rusak)', analyticsData.statusData.find(d => d.name === 'RUSAK')?.value || 0]);
    summaryRows.push(['', '']);

    // Type Breakdown
    summaryRows.push(['TROLLEY TYPES', 'JUMLAH']);
    analyticsData.typeData.forEach(d => summaryRows.push([d.name, d.value]));
    summaryRows.push(['', '']);

    // Damage Breakdown
    summaryRows.push(['DAMAGE CATEGORIES', 'JUMLAH']);
    analyticsData.remarksData.forEach(d => summaryRows.push([d.name, d.value]));
    summaryRows.push(['', '']);

    // New Parts Breakdown
    summaryRows.push(['NEW PARTS INSTALLED', 'JUMLAH']);
    analyticsData.newPartsData.forEach(d => summaryRows.push([d.name, d.value]));
    summaryRows.push(['', '']);

    // Input Status
    summaryRows.push(['INPUT STATUS', 'JUMLAH']);
    analyticsData.inputData.forEach(d => summaryRows.push([d.name, d.value]));

    const ws3 = XLSX.utils.aoa_to_sheet(summaryRows);
    ws3['!cols'] = [
      { wch: 35 }, { wch: 20 }
    ];

    // ====== Create Workbook with 3 Sheets ======
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Maintenance Trolley');
    XLSX.utils.book_append_sheet(wb, ws2, 'History Log');
    XLSX.utils.book_append_sheet(wb, ws3, 'Summary');
    XLSX.writeFile(wb, `Maintenance_Trolley_${format(new Date(), 'dd-MM-yyyy')}.xlsx`);
    toast.success('Data berhasil di-export dengan 3 sheet! (Data, History Log, Summary)');
  };

  const handleImportExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // ========================================================================
      // CRITICAL: CHECK SERVER CONNECTION BEFORE IMPORT
      // ========================================================================
      toast.info('Memeriksa koneksi server...', { duration: 2000, id: 'check-server' });

      const isServerHealthy = await maintenanceAPI.healthCheck();
      toast.dismiss('check-server');

      if (!isServerHealthy) {
        toast.error('❌ Server MySQL OFFLINE! Import Excel memerlukan koneksi online. Pastikan Laragon berjalan.', {
          duration: 8000,
        });
        event.target.value = '';
        return;
      }

      if (isUsingFallback) {
        toast.error('⚠️ Aplikasi dalam mode offline! Import Excel hanya bisa dilakukan dalam mode online.', {
          duration: 8000,
        });
        event.target.value = '';
        return;
      }

      // Server is online, proceed with import
      toast.success('✅ Server terhubung! Memulai import Excel...', { duration: 2000 });

      setIsImporting(true);
      setImportProgress(0);
      toast.info('Memproses file Excel...', { duration: 2000 });

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { cellDates: true });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];

      // Read as array of arrays (index-based) to handle various header layouts
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true }) as any[][];
      // Also read with raw:false to get formatted date strings (preserves dd/mm/yyyy from Excel)
      const formattedData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false }) as any[][];

      // Auto-detect header row by scanning for a row containing 'NO' and 'PART NUMBER' (or similar)
      let headerRowIndex = -1;
      let colOffset = 0;
      for (let i = 0; i < Math.min(10, rawData.length); i++) {
        const row = rawData[i] || [];
        const rowStr = row.map((c: any) => String(c || '').toUpperCase().trim());
        if (rowStr.includes('NO') && (rowStr.includes('PART NUMBER') || rowStr.includes('PART NO'))) {
          headerRowIndex = i;
          colOffset = Math.max(0, rowStr.indexOf('NO'));
          break;
        }
      }

      // If no header found, check for sub-column format (FULL, HALF, BP in any row)
      if (headerRowIndex === -1) {
        for (let i = 0; i < Math.min(10, rawData.length); i++) {
          const row = rawData[i] || [];
          const rowStr = row.map((c: any) => String(c || '').toUpperCase().trim());
          if (rowStr.includes('FULL') && rowStr.includes('HALF') && rowStr.includes('BP')) {
            headerRowIndex = i;
            // Best guess offset if FULL is usually at index 3
            colOffset = Math.max(0, rowStr.indexOf('FULL') - 3);
            break;
          }
        }
      }

      // Fallback: assume first row is header
      if (headerRowIndex === -1) headerRowIndex = 0;

      // Normalize data if columns are shifted (e.g. empty column A)
      if (colOffset > 0) {
        for (let i = 0; i < rawData.length; i++) {
          if (rawData[i]) rawData[i] = rawData[i].slice(colOffset);
        }
        console.log(`Column offset detected: shifted by ${colOffset} columns. Data realigned.`);
      }

      const dataStartRow = headerRowIndex + 1;
      console.log(`📋 Header row detected at row ${headerRowIndex + 1}, data starts at row ${dataStartRow + 1}`);

      let jsonData: any[] = rawData.slice(dataStartRow).filter((row: any[]) => row && row.length > 0 && row[0] != null);

      console.log(`Excel data loaded: ${jsonData.length} rows`);

      if (jsonData.length === 0) {
        toast.error('File Excel kosong!');
        setIsImporting(false);
        return;
      }

      if (jsonData.length > 10000) {
        toast.error('File terlalu besar! Maksimal 10,000 data per import.');
        setIsImporting(false);
        return;
      }

      // Show progress toast
      toast.info(`Memproses ${jsonData.length} data...`, { duration: Infinity, id: 'import-progress' });

      // Validate and convert Excel data to MaintenanceRecord format
      let successCount = 0;
      let errorCount = 0;
      const maxNo = records.length > 0 ? Math.max(...records.map(r => r.no)) : 0;

      // Convert checkbox values — supports boolean, string true/ya/1, and checkmark symbols (✔ ✓)
      const toBool = (val: any) => {
        if (typeof val === 'boolean') return val;
        if (typeof val === 'number') return val === 1;
        if (typeof val === 'string') {
          const trimmed = val.trim();
          // Check for checkmark symbols: ✔ (U+2714), ✓ (U+2713), ☑ (U+2611), ✅
          if (trimmed === '\u2714' || trimmed === '\u2713' || trimmed === '\u2611' || trimmed === '\u2705') return true;
          // Check for text values
          const lower = trimmed.toLowerCase();
          return lower === 'true' || lower === 'ya' || lower === 'yes' || lower === '1' || lower === 'v' || lower === 'x';
        }
        return false;
      };

      // Helper function to convert row (array) to record
      // Supports 16-column (old), 19-column (N.M, N.WS, N.BR), and 20-column (+ Date) formats
      const convertContohRow = (row: any[], index: number) => {
        try {
          // Detect format based on header row
          const headerRow = rawData[headerRowIndex] || [];
          const headerStr = headerRow.map((c: any) => String(c || '').toUpperCase());
          const hasNewCols = headerStr.includes('N.M') || headerStr.includes('N.WS') || headerStr.includes('N.BR');
          const hasDateCol = headerStr.includes('DATE');

          // Column mapping:
          // 20-col: 0=NO, 1=PART, 2=SERIAL, 3=Full, 4=Half, 5=BP, 6=WS, 7=BR, 8=LP, 9=M, 10=N.M, 11=N.WS, 12=N.BR, 13=FROM, 14=DELIVERY, 15=In, 16=Out, 17=Rep, 18=Cod, 19=Date
          // 19-col: 0=NO, 1=PART, 2=SERIAL, 3=Full, 4=Half, 5=BP, 6=WS, 7=BR, 8=LP, 9=M, 10=N.M, 11=N.WS, 12=N.BR, 13=FROM, 14=DELIVERY, 15=In, 16=Out, 17=Rep, 18=Cod
          // 16-col: 0=NO, 1=PART, 2=SERIAL, 3=Full, 4=Half, 5=BP, 6=WS, 7=BR, 8=LP, 9=M, 10=FROM, 11=DELIVERY, 12=In, 13=Out, 14=Rep, 15=Cod
          const fromIdx = hasNewCols ? 13 : 10;
          const deliveryIdx = hasNewCols ? 14 : 11;
          const inIdx = hasNewCols ? 15 : 12;
          const outIdx = hasNewCols ? 16 : 13;
          const repIdx = hasNewCols ? 17 : 14;
          const codIdx = hasNewCols ? 18 : 15;
          const dateIdx = hasDateCol ? (hasNewCols ? 19 : 16) : -1;

          const partNo = String(row[1] || '');
          const serial = String(row[2] || '');

          if (!partNo || !serial) {
            console.warn(`Row ${index + 1} skipped: missing Part No or Serial`);
            return null;
          }

          // Determine TYPE from boolean columns
          const isHalf = toBool(row[4]);
          const type = isHalf ? 'HALF' : 'FULL';

          // Determine INPUT from boolean columns
          // COD is always true, not used for input determination
          let input: 'IN' | 'OUT' | 'REP' = 'IN';
          if (toBool(row[outIdx])) input = 'OUT';
          else if (toBool(row[repIdx])) input = 'REP';

          // Determine STATUS from condition columns
          const hasConditionIssue = toBool(row[5]) || toBool(row[6]) || toBool(row[7]) || toBool(row[8]) || toBool(row[9]);

          // Parse DATE column — supports Date objects (cellDates:true), formatted strings, Excel serial numbers, dd/mm/yyyy, or empty (defaults to today)
          let dateValue = new Date();
          if (dateIdx >= 0 && row[dateIdx] != null && row[dateIdx] !== '') {
            const rawDate = row[dateIdx];
            // Get the formatted string version from the non-raw read (preserves dd/mm/yyyy display)
            const formattedRow = formattedData[headerRowIndex + 1 + index];
            const formattedDateStr = formattedRow ? String(formattedRow[dateIdx] || '') : '';

            if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
              // cellDates:true gives us a JS Date object — but it may have timezone offset issues
              // Use the formatted string from Excel to get the correct dd/mm/yyyy interpretation
              if (formattedDateStr) {
                const parts = formattedDateStr.trim().split(/[\/\-\.]/);
                if (parts.length === 3) {
                  let day: number, month: number, year: number;
                  if (parts[0].length === 4) {
                    year = parseInt(parts[0], 10);
                    month = parseInt(parts[1], 10) - 1;
                    day = parseInt(parts[2], 10);
                  } else {
                    // Assume dd/mm/yyyy (Indonesian locale)
                    day = parseInt(parts[0], 10);
                    month = parseInt(parts[1], 10) - 1;
                    year = parseInt(parts[2], 10);
                    if (year < 100) year += 2000;
                  }
                  if (!isNaN(day) && !isNaN(month) && !isNaN(year) && day >= 1 && day <= 31 && month >= 0 && month <= 11) {
                    dateValue = new Date(year, month, day, 12, 0, 0);
                  } else {
                    dateValue = new Date(rawDate.getFullYear(), rawDate.getMonth(), rawDate.getDate(), 12, 0, 0);
                  }
                } else {
                  dateValue = new Date(rawDate.getFullYear(), rawDate.getMonth(), rawDate.getDate(), 12, 0, 0);
                }
              } else {
                dateValue = new Date(rawDate.getFullYear(), rawDate.getMonth(), rawDate.getDate(), 12, 0, 0);
              }
            } else if (typeof rawDate === 'number') {
              // Excel serial number (days since 1900-01-01, with Excel's leap year bug)
              const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
              dateValue = new Date(excelEpoch.getTime() + rawDate * 86400000);
              dateValue.setHours(12, 0, 0, 0); // Normalize to noon to avoid timezone issues
            } else if (typeof rawDate === 'string') {
              const trimmed = rawDate.trim();
              // Try dd/mm/yyyy or dd-mm-yyyy format
              const parts = trimmed.split(/[\/\-\.]/);
              if (parts.length === 3) {
                let day: number, month: number, year: number;
                if (parts[0].length === 4) {
                  // yyyy-mm-dd
                  year = parseInt(parts[0], 10);
                  month = parseInt(parts[1], 10) - 1;
                  day = parseInt(parts[2], 10);
                } else {
                  // dd/mm/yyyy
                  day = parseInt(parts[0], 10);
                  month = parseInt(parts[1], 10) - 1;
                  year = parseInt(parts[2], 10);
                  if (year < 100) year += 2000;
                }
                if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                  dateValue = new Date(year, month, day, 12, 0, 0);
                }
              }
            }
          }

          const record = {
            no: maxNo + index + 1,
            partNo,
            serial,
            type: type as 'FULL' | 'HALF',
            atlas: 'ATLAS',
            posisi: '',
            remarkText: '',
            remarksBarcode: '',
            po: '',
            remarks: {
              bodyPart: toBool(row[5]),     // BP
              rodaRusak: toBool(row[6]),    // WS (Wheels)
              brakeSystem: toBool(row[7]),  // BR
              lockPart: toBool(row[8]),     // LP
              magnetRusak: toBool(row[9]),  // M
              magnetBaru: hasNewCols ? toBool(row[10]) : false,   // N.M
              rodaBaru: hasNewCols ? toBool(row[11]) : false,     // N.WS
              stikerBarcode: hasNewCols ? toBool(row[12]) : false,// N.BR
              swivelSingle: false,
              uttReck: false,
            },
            from: String(row[fromIdx] || ''),
            delivery: String(row[deliveryIdx] || ''),
            input,
            status: (hasConditionIssue ? 'UNSERVICEABLE' : 'SERVICEABLE') as 'SERVICEABLE' | 'UNSERVICEABLE',
            date: dateValue.toISOString(),
          };

          return record;
        } catch (error) {
          console.error(`Error converting row ${index + 1}:`, error);
          return null;
        }
      };

      // Helper function to convert legacy format row (object) to record
      const convertLegacyRow = (row: any[], index: number) => {
        try {
          // Legacy format is also array-based now
          // Try to detect column positions from row 1 headers
          const headers = rawData[0] || [];

          // Build a name→index map
          const colMap: Record<string, number> = {};
          headers.forEach((h: any, i: number) => {
            if (h) colMap[String(h).toUpperCase()] = i;
          });

          const getVal = (names: string[]) => {
            for (const name of names) {
              const idx = colMap[name.toUpperCase()];
              if (idx !== undefined && row[idx] != null) return row[idx];
            }
            return '';
          };

          const partNo = String(getVal(['PART NUMBER', 'PART NO']) || '');
          const serial = String(getVal(['SERIAL NUMBER', 'SERIAL NO', 'SERIAL']) || '');

          if (!partNo || !serial) {
            console.warn(`Row ${index + 1} skipped: missing Part No or Serial`);
            return null;
          }

          // Parse date
          let dateValue = new Date();
          const rawDate = getVal(['DATE', 'Date']);
          if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
            // cellDates:true gives us a JS Date object
            // Use the formatted data to get correct dd/mm/yyyy interpretation
            const formattedRow = formattedData[headerRowIndex + 1 + index] || formattedData[index + 1];
            const dateColIdx = Object.keys(colMap).find(k => k === 'DATE' || k === 'Date');
            const fmtIdx = dateColIdx ? colMap[dateColIdx] : -1;
            const formattedDateStr = fmtIdx >= 0 && formattedRow ? String(formattedRow[fmtIdx] || '') : '';
            if (formattedDateStr) {
              const parts = formattedDateStr.trim().split(/[\/\-\.]/);
              if (parts.length === 3) {
                let day, month, year;
                if (parts[0].length === 4) {
                  year = parseInt(parts[0], 10);
                  month = parseInt(parts[1], 10) - 1;
                  day = parseInt(parts[2], 10);
                } else {
                  day = parseInt(parts[0], 10);
                  month = parseInt(parts[1], 10) - 1;
                  year = parseInt(parts[2], 10);
                  if (year < 100) year += 2000;
                }
                if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                  dateValue = new Date(year, month, day, 12, 0, 0);
                } else {
                  dateValue = new Date(rawDate.getFullYear(), rawDate.getMonth(), rawDate.getDate(), 12, 0, 0);
                }
              } else {
                dateValue = new Date(rawDate.getFullYear(), rawDate.getMonth(), rawDate.getDate(), 12, 0, 0);
              }
            } else {
              dateValue = new Date(rawDate.getFullYear(), rawDate.getMonth(), rawDate.getDate(), 12, 0, 0);
            }
          } else if (rawDate && typeof rawDate === 'string') {
            const parts = rawDate.trim().split(/[\/\-\.\s]+/);
            if (parts.length === 3) {
              let day, month, year;
              if (parts[0].length === 4) {
                year = parseInt(parts[0], 10);
                month = parseInt(parts[1], 10) - 1;
                day = parseInt(parts[2], 10);
              } else {
                day = parseInt(parts[0], 10);
                month = parseInt(parts[1], 10) - 1;
                year = parseInt(parts[2], 10);
                if (year < 100) year += 2000;
              }
              if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                dateValue = new Date(year, month, day, 12, 0, 0);
              }
            }
          }

          let determinedType = 'FULL-ATLAS';
          if (toBool(getVal(['Half-Atlas', 'HALF-ATLAS', 'Half-Atlas ']))) determinedType = 'HALF-ATLAS';
          else if (toBool(getVal(['Full-Rekondisi', 'FULL-REKONDISI', 'Full-Rekondisi ']))) determinedType = 'FULL-REKONDISI';
          else if (toBool(getVal(['Half-Rekondisi', 'HALF-REKONDISI', 'Half-Rekondisi ']))) determinedType = 'HALF-REKONDISI';
          else if (toBool(getVal(['Full-Atlas', 'FULL-ATLAS', 'Full-Atlas ']))) determinedType = 'FULL-ATLAS';

          let determinedInput = 'IN';
          if (toBool(getVal(['Out', 'OUT']))) determinedInput = 'OUT';
          else if (toBool(getVal(['Rep', 'REP']))) determinedInput = 'REP';
          else if (toBool(getVal(['Cod', 'COD']))) determinedInput = 'COD';
          else if (toBool(getVal(['In', 'IN']))) determinedInput = 'IN';
          
          const rawInputStr = String(getVal(['INPUT', 'Input'])).toUpperCase();
          if (rawInputStr === 'OUT' || rawInputStr === 'REP' || rawInputStr === 'COD' || rawInputStr === 'IN') {
            determinedInput = rawInputStr;
          }

          const record = {
            no: maxNo + index + 1,
            partNo,
            serial,
            type: determinedType as 'FULL-ATLAS' | 'HALF-ATLAS' | 'FULL-REKONDISI' | 'HALF-REKONDISI',
            atlas: determinedType.includes('ATLAS') ? 'ATLAS' : 'REKONDISI',
            posisi: String(getVal(['POSISI', 'Posisi']) || ''),
            remarkText: String(getVal(['REMARK', 'Remark']) || ''),
            remarksBarcode: String(getVal(['REMARKS BARCODE', 'Remarks Barcode']) || ''),
            po: String(getVal(['PO', 'Po']) || ''),
            remarks: {
              bodyPart: toBool(getVal(['BP', 'BODY PART', 'Body Part'])),
              brakeSystem: toBool(getVal(['BR', 'BRAKE SYSTEM', 'Brake System'])),
              magnetRusak: toBool(getVal(['M', 'MAGNET RUSAK', 'Magnet Rusak'])),
              rodaRusak: toBool(getVal(['WS', 'RODA RUSAK', 'Roda Rusak'])),
              lockPart: toBool(getVal(['LP', 'LOCK PART', 'Lock Part'])),
              swivelSingle: false,
              magnetBaru: toBool(getVal(['N.M', 'NEW MAGNET'])),
              rodaBaru: toBool(getVal(['N.WS', 'NEW WHEELS'])),
              stikerBarcode: toBool(getVal(['N.BR', 'NEW BRAKE'])),
              uttReck: false,
            },
            from: String(getVal(['FROM', 'From']) || ''),
            delivery: String(getVal(['DELIVERY', 'Delivery']) || ''),
            input: determinedInput as 'IN' | 'OUT' | 'REP' | 'COD',
            status: (String(getVal(['CATEGORY', 'CONDITION', 'Status', 'Category']) || 'SERVICEABLE').toUpperCase() === 'RUSAK' ? 'UNSERVICEABLE' : 'SERVICEABLE') as 'SERVICEABLE' | 'UNSERVICEABLE',
            date: dateValue.toISOString(),
          };

          return record;
        } catch (error) {
          console.error(`Error converting row ${index + 1}:`, error);
          return null;
        }
      };

      // Convert all rows
      const validRecords = [];
      const errors = [];
      for (let i = 0; i < jsonData.length; i++) {
        const record = convertLegacyRow(jsonData[i], i);
        if (record) {
          validRecords.push(record);
        } else {
          errorCount++;
          errors.push(`Row ${i + dataStartRow + 1}: Invalid data format`);
        }
      }

      if (errors.length > 0) {
        console.warn('Import Validation Errors:', errors);
      }

      console.log(`Validated ${validRecords.length} records, ${errorCount} errors`);

      // ========================================================================
      // USE OPTIMIZED BATCH API FOR LARGE IMPORTS (6000+ records)
      // ========================================================================
      console.log(`🚀 Starting optimized batch import for ${validRecords.length} records...`);
      console.log(`📊 Total records to import: ${validRecords.length}`);
      console.log(`📊 Expected batches: ${Math.ceil(validRecords.length / 100)}`);

      const result = await maintenanceAPI.createBatch(
        validRecords,
        (current, total, batchSuccessCount, batchErrorCount) => {
          // Update progress in real-time
          const progress = Math.round((current / total) * 100);
          setImportProgress(progress);

          successCount = batchSuccessCount;
          errorCount = batchErrorCount;

          console.log(`📈 Progress update: ${current}/${total} | Success: ${batchSuccessCount} | Errors: ${batchErrorCount}`);

          toast.info(`📦 Progress: ${progress}% | ✅ ${successCount} sukses | ❌ ${errorCount} gagal`, {
            duration: Infinity,
            id: 'import-progress'
          });
        }
      );

      successCount = result.successCount;
      const updateCount = result.updateCount || 0;
      const createdCount = successCount - updateCount;
      errorCount = result.errorCount;

      console.log(`🎉 Import finished! Success: ${successCount}, Errors: ${errorCount}`);
      console.log(`📊 Total records in Excel: ${jsonData.length}`);
      console.log(`📊 Valid records processed: ${validRecords.length}`);
      console.log(`📊 Success rate: ${((successCount / validRecords.length) * 100).toFixed(2)}%`);

      // Dismiss progress toast
      toast.dismiss('import-progress');

      // ========================================================================
      // VERIFICATION STEP - Reload and count records in database
      // ========================================================================
      console.log(`\n🔍 ========================================`);
      console.log(`🔍 VERIFYING DATA IN DATABASE...`);
      console.log(`🔍 ========================================`);

      toast.info('🔍 Memverifikasi data di database...', { duration: 2000, id: 'verify' });

      // Reload records from server
      await loadRecords();

      toast.dismiss('verify');

      console.log(`✅ Database records count: ${records.length}`);
      console.log(`✅ Expected after import: ${records.length} (previous) + ${successCount} (new) = ${records.length + successCount}`);
      console.log(`🔍 ========================================\n`);

      // Show result with actual database count
      // Show result with actual database count
      if (successCount > 0) {
        const importDetails = [];
        if (createdCount > 0) importDetails.push(`🆕 ${createdCount} data baru dibuat`);
        if (updateCount > 0) importDetails.push(`🔄 ${updateCount} data diupdate`);
        if (errorCount > 0) importDetails.push(`❌ ${errorCount} data gagal`);

        toast.success(`✅ Import berhasil!\n\n${importDetails.join('\n')}\n\n📊 Total data di database sekarang: ${records.length + createdCount} records`, {
          duration: 8000,
        });
      } else {
        toast.error('❌ Tidak ada data yang berhasil diimport');
      }

      // Show specific errors if any
      if (result.errors && result.errors.length > 0) {
        // Show first 3 errors in toast
        const errorMsg = result.errors.slice(0, 3).join('\n');
        const remaining = result.errors.length - 3;

        toast.error(`Detail Gagal Import:\n${errorMsg}${remaining > 0 ? `\n...dan ${remaining} error lainnya` : ''}`, {
          duration: 10000
        });

        console.error('ALL IMPORT ERRORS:', result.errors);
      }

      // Reset file input
      event.target.value = '';
    } catch (error) {
      console.error('Error importing Excel:', error);
      toast.dismiss('import-progress');
      toast.error('Gagal import data Excel: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  const downloadTemplate = () => {
    // FORMAT MAINTENANCE TROLLEY NEW structure (19 columns):
    // Row 1: Title (merged A1:S1)
    const titleRow = ['Ceklist Form Maintenance Trolley', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''];
    // Row 2: Legend
    const legendRow = ['BP ( BODY PART )', '', 'BR ( BRAKE )', 'M ( MAGNET )', '', 'WS ( WHEELS )', '', 'LP ( LOCK PART )', '', 'N.M ( NEW MAGNET )', '', '', 'N.WS ( NEW WHEELS )', '', 'N.BR ( NEW BRAKE )', '', '', '', ''];
    // Row 3: Date
    const dateRow = ['', '', '', '', '', '', '', '', '', '', '', '', '', '', 'Date :', '', '', '', ''];
    // Row 4: Column headers
    const headerRow = ['NO', 'PART NUMBER', 'SERIAL NUMBER', 'Full-Atlas', 'Half-Atlas', 'Full-Rekondisi', 'Half-Rekondisi', 'BP', 'WS', 'BR', 'LP', 'M', 'N.M', 'N.WS', 'N.BR', 'FROM', 'DELIVERY', 'In', 'Out', 'Rep', 'Cod', 'Date', 'PO'];

    // Sample data rows (19 columns)
    const sampleRow1 = [1, 'TK600052', '16261269', false, true, false, false, false, false, false, true, false, true, 'CGK', 'DPS', true, false, false, false];
    const sampleRow2 = [2, 'TL600016', '15252148', true, false, true, true, false, false, false, false, true, false, 'CGK', 'DPS', false, true, false, false];

    const ws = XLSX.utils.aoa_to_sheet([titleRow, legendRow, dateRow, headerRow, sampleRow1, sampleRow2]);

    // Merge title row + legend merges
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 18 } },  // Title A1:S1
      { s: { r: 1, c: 9 }, e: { r: 1, c: 10 } },   // N.M legend J2:K2
      { s: { r: 1, c: 12 }, e: { r: 1, c: 13 } },  // N.WS legend M2:N2
      { s: { r: 1, c: 14 }, e: { r: 1, c: 15 } },  // N.BR legend O2:P2
    ];

    // Set column widths
    ws['!cols'] = [
      { wch: 5 },   // NO
      { wch: 15 },  // PART NUMBER
      { wch: 15 },  // SERIAL NUMBER
      { wch: 8 },   // Full
      { wch: 8 },   // Half
      { wch: 8 },   // BP
      { wch: 8 },   // WS
      { wch: 8 },   // BR
      { wch: 8 },   // LP
      { wch: 8 },   // M
      { wch: 8 },   // N.M
      { wch: 8 },   // N.WS
      { wch: 8 },   // N.BR
      { wch: 10 },  // FROM
      { wch: 10 },  // DELIVERY
      { wch: 8 },   // In
      { wch: 8 },   // Out
      { wch: 8 },   // Rep
      { wch: 8 },   // Cod
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'Template_Ceklist_Maintenance_Trolley.xlsx');
    toast.success('Template berhasil didownload!');
  };

  // ========================================================================
  // DATA TO DISPLAY - Using memoized analytics data for performance
  // ========================================================================
  const { typeData, typeBreakdownData, statusData, inputData, remarksData, newPartsData } = analyticsData;

  // Type Distribution filtered by status
  const typeFilteredData = useMemo(() => {
    if (typeStatusFilter === 'ALL') return typeData;
    if (typeStatusFilter === 'SERVICEABLE') {
      return typeBreakdownData.map(d => ({ name: d.name, value: d.serviceable }));
    }
    return typeBreakdownData.map(d => ({ name: d.name, value: d.unserviceable }));
  }, [typeStatusFilter, typeData, typeBreakdownData]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d', '#ffc658', '#ff7c7c', '#a4de6c'];

  // Auth state
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();

  // Set default tab based on user role (operators can't see form tab)
  useEffect(() => {
    if (user?.role === 'operator' && activeTab === 'form') {
      setActiveTab('data');
    }
  }, [user, activeTab]);

  // Show login page if not authenticated
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto overflow-x-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
            <div className="w-full lg:w-auto">
              <div className="flex flex-wrap items-center gap-2 md:gap-3">
                <h1 className="text-xl md:text-2xl lg:text-3xl font-bold">CEKLIST MAINTENANCE TROLLEY</h1>
                {!isUsingFallback ? (
                  <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></span>
                    Mode Online - MySQL Laragon
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-orange-100 text-orange-800 text-sm font-medium rounded-full">
                    Mode Offline - Local Storage
                  </span>
                )}
              </div>
              <p className="text-gray-600 mt-2">
                Sistem manajemen maintenance trolley dengan dashboard analisa
                {!isUsingFallback && " - Terhubung ke database cloud"}
                {isUsingFallback && " - Data tersimpan di browser"}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap w-full lg:w-auto">
              {/* Admin-only: Date picker for input */}
              {user?.role === 'admin' && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      {format(date, 'dd MMM yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent mode="single" selected={date} onSelect={(d) => d && setDate(d)} />
                  </PopoverContent>
                </Popover>
              )}
              {/* Admin-only: Import Excel */}
              {user?.role === 'admin' && (
                <>
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    className="hidden"
                    id="importExcel"
                    onChange={handleImportExcel}
                    disabled={isImporting || loading}
                  />
                  <label htmlFor="importExcel">
                    <Button
                      type="button"
                      className={`flex items-center gap-2 ${isUsingFallback ? 'bg-gray-400 hover:bg-gray-500' : 'bg-green-600 hover:bg-green-700'}`}
                      disabled={isImporting || loading || isUsingFallback}
                      onClick={(e) => {
                        e.preventDefault();
                        if (isUsingFallback) {
                          toast.error('⚠️ Import Excel hanya tersedia dalam mode ONLINE!', { duration: 5000 });
                          return;
                        }
                        document.getElementById('importExcel')?.click();
                      }}
                    >
                      {isImporting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {importProgress > 0 ? `${importProgress}%` : 'Importing...'}
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          Import Excel {isUsingFallback && '(Offline)'}
                        </>
                      )}
                    </Button>
                  </label>
                </>
              )}

              {/* Everyone can download template and export */}
              <Button onClick={downloadTemplate} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700" disabled={isImporting || loading}>
                <Download className="w-4 h-4" />
                Template Excel
              </Button>
              <Button onClick={exportToExcel} className="flex items-center gap-2 bg-black hover:bg-gray-800" disabled={isImporting || loading}>
                <Download className="w-4 h-4" />
                Export Excel
              </Button>
              {/* Admin-only: Delete buttons */}
              {user?.role === 'admin' && (
                <Button
                  onClick={handleDeleteAll}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700"
                  disabled={isImporting || loading || records.length === 0}
                >
                  <Trash2 className="w-4 h-4" />
                  Hapus Semua Data
                </Button>
              )}
              {/* User Info & Logout */}
              <div className="flex items-center gap-2 ml-4 pl-4 border-l border-gray-300">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <User className="w-4 h-4" />
                  <span className="font-medium">{user?.name}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${user?.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                    {user?.role === 'admin' ? 'Admin' : 'Operator'}
                  </span>
                </div>
                <Button
                  onClick={logout}
                  variant="outline"
                  className="flex items-center gap-2 text-red-600 border-red-300 hover:bg-red-50"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </Button>
              </div>
            </div>
          </div>

          {/* Tabs - Show Form Input only for Admin */}
          <TabsList className={`grid w-full ${user?.role === 'admin' ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {user?.role === 'admin' && <TabsTrigger value="form">Form Input</TabsTrigger>}
            <TabsTrigger value="data">Data Tabel</TabsTrigger>
            <TabsTrigger value="dashboard">Dashboard Analisa</TabsTrigger>
          </TabsList>

          {/* Form Tab */}
          <TabsContent value="form">
            <Card>
              <CardHeader>
                <CardTitle>{editingId ? 'Edit Data' : 'Input Data Baru'}</CardTitle>
                <CardDescription>Lengkapi form di bawah ini untuk menambah data maintenance trolley</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Row 1: Part Number, Serial Number, Type */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="partNo">Part Number</Label>
                    <Select value={formData.partNo} onValueChange={(value) => handleInputChange('partNo', value)}>
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Pilih Part Number" />
                      </SelectTrigger>
                      <SelectContent>
                        {availablePartNumbers.map(part => (
                          <SelectItem key={part} value={part}>{part}</SelectItem>
                        ))}
                        <SelectItem value="LAINNYA" className="font-bold text-blue-600">Lainnya (Input Manual)...</SelectItem>
                      </SelectContent>
                    </Select>
                    {formData.partNo === 'LAINNYA' && (
                      <Input
                        placeholder="Ketik part number baru..."
                        value={customPartNo}
                        onChange={(e) => setCustomPartNo(e.target.value)}
                        className="mt-2 border-blue-300 focus-visible:ring-blue-500"
                        autoFocus
                      />
                    )}
                  </div>
                  <div>
                    <Label htmlFor="serial">Serial Number</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        id="serial"
                        placeholder="Masukkan Serial Number"
                        value={formData.serial}
                        onChange={(e) => handleInputChange('serial', e.target.value)}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setFormBarcodeScannerOpen(true)}
                        title="Scan Barcode"
                        className="shrink-0 border-blue-300 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                      >
                        <ScanLine className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="type">Type</Label>
                    <Select value={formData.type} onValueChange={(value: any) => handleInputChange('type', value)}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FULL-ATLAS">FULL-ATLAS</SelectItem>
                        <SelectItem value="HALF-ATLAS">HALF-ATLAS</SelectItem>
                        <SelectItem value="FULL-REKONDISI">FULL-REKONDISI</SelectItem>
                        <SelectItem value="HALF-REKONDISI">HALF-REKONDISI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Condition Section - checkboxes matching paper form */}
                <div>
                  <Label className="mb-3 block font-semibold">Condition <span className="text-xs font-normal text-gray-500">(centang jika rusak)</span></Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                    {[
                      { key: 'bodyPart', label: 'BP (Body Part)' },
                      { key: 'brakeSystem', label: 'BR (Brake)' },
                      { key: 'magnetRusak', label: 'M (Magnet)' },
                      { key: 'rodaRusak', label: 'WS (Wheels)' },
                      { key: 'lockPart', label: 'LP (Lock Part)' },
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-2 p-2 border rounded-lg hover:bg-gray-50">
                        <Checkbox
                          id={key}
                          checked={formData.remarks[key as keyof typeof formData.remarks]}
                          onCheckedChange={() => handleCheckboxChange(key)}
                        />
                        <Label htmlFor={key} className="font-normal cursor-pointer text-sm">
                          {label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* New Parts Section - checkboxes for new replacement parts */}
                <div>
                  <Label className="mb-3 block font-semibold">New Parts <span className="text-xs font-normal text-gray-500">(centang jika diganti baru)</span></Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {[
                      { key: 'magnetBaru', label: 'N.M (New Magnet)' },
                      { key: 'rodaBaru', label: 'N.WS (New Wheels)' },
                      { key: 'stikerBarcode', label: 'N.BR (New Brake)' },
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-2 p-2 border rounded-lg hover:bg-blue-50">
                        <Checkbox
                          id={key}
                          checked={formData.remarks[key as keyof typeof formData.remarks]}
                          onCheckedChange={() => handleCheckboxChange(key)}
                        />
                        <Label htmlFor={key} className="font-normal cursor-pointer text-sm">
                          {label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Row 2: From, Delivery, Input, PO */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="from">From</Label>
                    <Input
                      id="from"
                      placeholder="Asal"
                      value={formData.from}
                      onChange={(e) => handleInputChange('from', e.target.value)}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="delivery">Delivery</Label>
                    <Input
                      id="delivery"
                      placeholder="Tujuan pengiriman"
                      value={formData.delivery}
                      onChange={(e) => handleInputChange('delivery', e.target.value)}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="input">Input</Label>
                    <Select value={formData.input} onValueChange={(value) => handleInputChange('input', value)}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="IN">IN</SelectItem>
                        <SelectItem value="OUT">OUT</SelectItem>
                        <SelectItem value="REP">REP</SelectItem>
                        <SelectItem value="COD">COD</SelectItem>

                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="po">PO</Label>
                    <Input
                      id="po"
                      type="number"
                      placeholder="Nomor PO"
                      value={formData.po}
                      onChange={(e) => handleInputChange('po', e.target.value)}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label>Tanggal</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full mt-2 flex items-center justify-start gap-2 font-normal">
                          <Calendar className="w-4 h-4" />
                          {format(date, 'dd/MM/yyyy')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarComponent mode="single" selected={date} onSelect={(d) => d && setDate(d)} />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end gap-2">
                  {editingId && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditingId(null);
                        setFormData({
                          partNo: '',
                          serial: '',
                          type: 'FULL-ATLAS',
                          atlas: '',
                          from: '',
                          delivery: '',
                          input: 'IN',
                          posisi: '',
                          remarkText: '',
                          remarksBarcode: '',
                          status: 'SERVICEABLE',
                          po: '',
                          remarks: {
                            lockPart: false,
                            brakeSystem: false,
                            bodyPart: false,
                            swivelSingle: false,
                            magnetRusak: false,
                            magnetBaru: false,
                            rodaRusak: false,
                            rodaBaru: false,
                            stikerBarcode: false,
                            uttReck: false,
                          },
                        });
                      }}
                      disabled={loading}
                    >
                      Batal
                    </Button>
                  )}
                  <Button onClick={handleSubmit} className="flex items-center gap-2 bg-black hover:bg-gray-800" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        {editingId ? 'Update Data' : 'Tambah Data'}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data Table Tab */}
          <TabsContent value="data">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Data Maintenance Trolley</CardTitle>
                    <CardDescription>
                      Menampilkan {displayRecords.length} data{useFilter && ` (Filter aktif dari ${filterStartDate ? format(filterStartDate, 'dd/MM/yyyy') : 'Semua'} - ${filterEndDate ? format(filterEndDate, 'dd/MM/yyyy') : 'Semua'})`} | Total database: {records.length} records
                    </CardDescription>
                  </div>
                  <div className="flex gap-2 items-center">
                    <div className="flex gap-2 items-center mr-2">
                      <div className="relative w-64">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                        <Input
                          placeholder="Cari Part No, Serial, Status..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-8"
                        />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSearchBarcodeScannerOpen(true)}
                        title="Scan Barcode untuk mencari Serial Number"
                        className="flex items-center gap-1.5 border-blue-300 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                      >
                        <ScanLine className="w-4 h-4" />
                        Scan
                      </Button>
                    </div>
                    <Button
                      variant={useFilter ? "default" : "outline"}
                      size="sm"
                      className="flex items-center gap-2"
                      onClick={() => setUseFilter(!useFilter)}
                    >
                      <Filter className="w-4 h-4" />
                      {useFilter ? 'Filter ON' : 'Tampilkan Semua'}
                    </Button>
                    {useFilter && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Ubah Filter
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[90vw] sm:w-[500px] p-0 max-h-[60vh] flex flex-col"
                          align="end"
                          side="top"
                          sideOffset={5}
                          collisionPadding={20}
                        >
                          {/* Sticky Header */}
                          <div className="sticky top-0 bg-white z-10 p-4 pb-2 border-b shadow-sm">
                            <h4 className="font-medium">🔍 Filter Data</h4>
                            <p className="text-xs text-gray-500 mt-1">Scroll ke bawah untuk melihat semua opsi filter ↓</p>
                          </div>

                          {/* Scrollable Content */}
                          <div className="overflow-y-auto p-4 space-y-4 flex-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 #f1f5f9' }}>
                            {/* Date Filter */}
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label className="text-xs mb-1 block">Dari Tanggal</Label>
                                <Select
                                  value={filterStartDate ? 'custom' : 'all'}
                                  onValueChange={(val) => {
                                    if (val === 'all') {
                                      setFilterStartDate(null);
                                    } else {
                                      setFilterStartDate(startOfMonth(new Date()));
                                    }
                                  }}
                                >
                                  <SelectTrigger className="h-8 mb-2">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">Semua Tanggal</SelectItem>
                                    <SelectItem value="custom">Pilih Tanggal</SelectItem>
                                  </SelectContent>
                                </Select>
                                {filterStartDate && (
                                  <CalendarComponent
                                    mode="single"
                                    selected={filterStartDate}
                                    onSelect={(d) => d && setFilterStartDate(d)}
                                    className="rounded-md border shadow-sm"
                                  />
                                )}
                              </div>
                              <div>
                                <Label className="text-xs mb-1 block">Sampai Tanggal</Label>
                                <Select
                                  value={filterEndDate ? 'custom' : 'all'}
                                  onValueChange={(val) => {
                                    if (val === 'all') {
                                      setFilterEndDate(null);
                                    } else {
                                      setFilterEndDate(endOfMonth(new Date()));
                                    }
                                  }}
                                >
                                  <SelectTrigger className="h-8 mb-2">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">Semua Tanggal</SelectItem>
                                    <SelectItem value="custom">Pilih Tanggal</SelectItem>
                                  </SelectContent>
                                </Select>
                                {filterEndDate && (
                                  <CalendarComponent
                                    mode="single"
                                    selected={filterEndDate}
                                    onSelect={(d) => d && setFilterEndDate(d)}
                                    className="rounded-md border shadow-sm"
                                  />
                                )}
                              </div>
                            </div>

                            {/* Advanced Filters */}
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label className="text-xs mb-1 block">Status</Label>
                                <Select value={filterStatus} onValueChange={setFilterStatus}>
                                  <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Semua Status" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="ALL">Semua Status</SelectItem>
                                    <SelectItem value="SERVICEABLE">Serviceable</SelectItem>
                                    <SelectItem value="UNSERVICEABLE">Unserviceable</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs mb-1 block">Type</Label>
                                <Select value={filterType} onValueChange={setFilterType}>
                                  <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Semua Tipe" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="ALL">Semua Tipe</SelectItem>
                                    <SelectItem value="FULL-ATLAS">FULL-ATLAS</SelectItem>
                                    <SelectItem value="HALF-ATLAS">HALF-ATLAS</SelectItem>
                                    <SelectItem value="FULL-REKONDISI">FULL-REKONDISI</SelectItem>
                                    <SelectItem value="HALF-REKONDISI">HALF-REKONDISI</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs mb-1 block">Input Status</Label>
                                <Select value={filterInput} onValueChange={setFilterInput}>
                                  <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Semua Input" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="ALL">Semua Input</SelectItem>
                                    <SelectItem value="IN">IN</SelectItem>
                                    <SelectItem value="OUT">OUT</SelectItem>
                                    <SelectItem value="REP">REP</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs mb-1 block">Kategori Kerusakan</Label>
                                <Select value={filterDamageCategory} onValueChange={setFilterDamageCategory}>
                                  <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Semua Kategori" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="ALL">Semua Kategori</SelectItem>
                                    <SelectItem value="bodyPart">BP (Body Part)</SelectItem>
                                    <SelectItem value="brakeSystem">BR (Brake)</SelectItem>
                                    <SelectItem value="magnetRusak">M (Magnet)</SelectItem>
                                    <SelectItem value="rodaRusak">WS (Wheels)</SelectItem>
                                    <SelectItem value="lockPart">LP (Lock Part)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-xs mb-1 block">New Parts</Label>
                                <Select value={filterNewParts} onValueChange={setFilterNewParts}>
                                  <SelectTrigger className="h-8">
                                    <SelectValue placeholder="Semua New Parts" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="ALL">Semua New Parts</SelectItem>
                                    <SelectItem value="magnetBaru">N.M (New Magnet)</SelectItem>
                                    <SelectItem value="rodaBaru">N.WS (New Wheels)</SelectItem>
                                    <SelectItem value="stikerBarcode">N.BR (New Brake)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* Position Filter */}
                            <div>
                              <Label className="text-xs mb-1 block">Position</Label>
                              <Input
                                value={filterFrom}
                                onChange={(e) => setFilterFrom(e.target.value)}
                                placeholder="Cari Position..."
                                className="h-8 text-xs"
                              />
                            </div>
                          </div>

                          {/* Sticky Footer */}
                          <div className="sticky bottom-0 bg-white z-10 p-4 pt-2 border-t shadow-[0_-2px_4px_rgba(0,0,0,0.1)]">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="w-full"
                              onClick={() => {
                                setFilterStatus('ALL');
                                setFilterType('ALL');
                                setFilterInput('ALL');
                                setFilterDamageCategory('ALL');
                                setFilterNewParts('ALL');
                                setFilterFrom('');
                                setFilterStartDate(null);
                                setFilterEndDate(null);
                              }}
                            >
                              Reset Semua Filter
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Virtualized Table for 5000+ records performance */}
                <div className="border rounded-lg overflow-hidden">
                  {/* Fixed Header */}
                  <div style={{ paddingRight: '17px' }}>
                    <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                      <colgroup>
                        <col style={{ width: '20%' }} />
                        <col style={{ width: '20%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '13%' }} />
                        <col style={{ width: '10%' }} />
                        {user?.role === 'admin' && <col style={{ width: '13%' }} />}
                      </colgroup>
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="border-b p-2 text-left cursor-pointer select-none hover:bg-gray-200" onClick={() => handleSort('partNo')}>
                            <div className="flex items-center">Part Number {getSortIcon('partNo')}</div>
                          </th>
                          <th className="border-b p-2 text-left">Serial Number</th>
                          <th className="border-b p-2 text-left">Type</th>
                          <th className="border-b p-2 text-left cursor-pointer select-none hover:bg-gray-200" onClick={() => handleSort('status')}>
                            <div className="flex items-center">Status {getSortIcon('status')}</div>
                          </th>
                          <th className="border-b p-2 text-left cursor-pointer select-none hover:bg-gray-200" onClick={() => handleSort('date')}>
                            <div className="flex items-center">Date {getSortIcon('date')}</div>
                          </th>
                          <th className="border-b p-2 text-left">Input</th>
                          {user?.role === 'admin' && <th className="border-b p-2 text-left">Aksi</th>}
                        </tr>
                      </thead>
                    </table>
                  </div>

                  {/* Virtualized Body */}
                  <div
                    ref={tableContainerRef}
                    className="overflow-auto"
                    style={{ height: 'calc(100vh - 400px)', minHeight: '400px' }}
                  >
                    {loading ? (
                      <div className="flex items-center justify-center h-32">
                        <Loader2 className="w-6 h-6 animate-spin" />
                      </div>
                    ) : displayRecords.length === 0 ? (
                      <div className="flex items-center justify-center h-32 text-gray-500">
                        Belum ada data. Silakan tambahkan data baru.
                      </div>
                    ) : (
                      <div
                        style={{
                          height: `${rowVirtualizer.getTotalSize()}px`,
                          width: '100%',
                          position: 'relative',
                        }}
                      >
                        <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                          <colgroup>
                            <col style={{ width: '20%' }} />
                            <col style={{ width: '20%' }} />
                            <col style={{ width: '12%' }} />
                            <col style={{ width: '12%' }} />
                            <col style={{ width: '13%' }} />
                            <col style={{ width: '10%' }} />
                            {user?.role === 'admin' && <col style={{ width: '13%' }} />}
                          </colgroup>
                          <tbody>
                            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                              const record = displayRecords[virtualRow.index];
                              const hasConditionIssue = record.remarks.bodyPart || record.remarks.brakeSystem || record.remarks.magnetRusak || record.remarks.rodaRusak || record.remarks.lockPart;
                              return (
                                <tr
                                  key={record.id}
                                  className="hover:bg-gray-50 border-b"
                                  style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: `${virtualRow.size}px`,
                                    transform: `translateY(${virtualRow.start}px)`,
                                    display: 'table',
                                    tableLayout: 'fixed',
                                  }}
                                >
                                  <td className="p-2 overflow-hidden" style={{ width: '20%' }}>{record.partNo}</td>
                                  <td className="p-2 overflow-hidden" style={{ width: '20%' }}>
                                    <button
                                      className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium text-left"
                                      onClick={() => handleViewHistory(record.serial)}
                                      title="Klik untuk lihat history"
                                    >
                                      {record.serial}
                                    </button>
                                  </td>
                                  <td className="p-2 overflow-hidden" style={{ width: '12%' }}>
                                    <span
                                      className={`px-2 py-1 rounded text-xs font-medium ${record.type.includes('FULL') ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}
                                    >
                                      {record.type}
                                    </span>
                                  </td>
                                  <td className="p-2 overflow-hidden" style={{ width: '12%' }}>
                                    <span
                                      className={`px-2 py-1 rounded text-xs font-medium ${hasConditionIssue ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}
                                    >
                                      {hasConditionIssue ? 'UNSERVICEABLE' : 'SERVICEABLE'}
                                    </span>
                                  </td>
                                  <td className="p-2 overflow-hidden text-xs" style={{ width: '13%' }}>
                                    {record.date ? new Date(record.date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                                  </td>
                                  <td className="p-2 overflow-hidden" style={{ width: '10%' }}>
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${record.input === 'COD' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
                                      {record.input === 'COD' ? '-' : record.input}
                                    </span>
                                  </td>
                                  {user?.role === 'admin' && (
                                    <td className="p-2" style={{ width: '13%' }}>
                                      <div className="flex gap-2">
                                        <Button size="sm" variant="outline" onClick={() => handleEdit(record)} disabled={loading}>
                                          <Edit className="w-3 h-3" />
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => handleDelete(record.id)} disabled={loading}>
                                          <Trash2 className="w-3 h-3 text-red-600" />
                                        </Button>
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                {/* Performance indicator */}
                <div className="mt-2 text-xs text-gray-400 text-right">
                  💡 Virtual scroll aktif - Hanya {Math.min(displayRecords.length, 25)} dari {displayRecords.length} baris di-render
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Dashboard Analisa</CardTitle>
                      <CardDescription>
                        Menampilkan analisa dari seluruh {records.length} data (filter tabel tidak mempengaruhi dashboard)
                      </CardDescription>
                    </div>
                    {/* Filter button removed - dashboard always shows all data */}
                  </div>
                </CardHeader>
              </Card>

              {records.length === 0 ? (
                <Card>
                  <CardContent className="p-12">
                    <div className="text-center text-gray-500">
                      <p className="text-lg font-medium mb-2">Tidak ada data untuk ditampilkan</p>
                      <p className="text-sm">Silakan tambahkan data terlebih dahulu atau ubah filter tanggal</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">Total Data</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">{records.length}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">Serviceable</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-green-600">{records.filter((r) => r.status === 'SERVICEABLE').length}</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">Unserviceable</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-red-600">{records.filter((r) => r.status === 'UNSERVICEABLE').length}</div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Status Distribution</CardTitle>
                        <CardDescription>Distribusi status trolley</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div style={{ width: '100%', height: 300 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={statusData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={(entry) => `${entry.name}: ${entry.value}`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                              >
                                {statusData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle>Type Distribution</CardTitle>
                            <CardDescription>
                              Distribusi tipe trolley
                              {typeStatusFilter !== 'ALL' && (
                                <span className={`ml-1 font-medium ${typeStatusFilter === 'SERVICEABLE' ? 'text-green-600' : 'text-red-600'}`}>
                                  — {typeStatusFilter === 'SERVICEABLE' ? 'Serviceable' : 'Unserviceable'}
                                </span>
                              )}
                            </CardDescription>
                          </div>
                          <Select value={typeStatusFilter} onValueChange={(val) => setTypeStatusFilter(val as 'ALL' | 'SERVICEABLE' | 'UNSERVICEABLE')}>
                            <SelectTrigger className="w-[140px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ALL">Semua Status</SelectItem>
                              <SelectItem value="SERVICEABLE">Serviceable</SelectItem>
                              <SelectItem value="UNSERVICEABLE">Unserviceable</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div style={{ width: '100%', height: 300 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={typeFilteredData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              <Bar dataKey="value" fill={typeStatusFilter === 'UNSERVICEABLE' ? '#FF6B6B' : typeStatusFilter === 'SERVICEABLE' ? '#00C49F' : '#0088FE'} name="Jumlah" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle>Input Type Distribution</CardTitle>
                            <CardDescription>
                              Distribusi kondisi {inputMonth !== 'ALL' ? `bulan ${['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'][parseInt(inputMonth)]}` : 'per bulan'} tahun {inputYear}
                            </CardDescription>
                          </div>
                          <div className="flex gap-2">
                            <Select value={inputMonth} onValueChange={setInputMonth}>
                              <SelectTrigger className="w-[120px] h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ALL">Semua Bulan</SelectItem>
                                <SelectItem value="0">Januari</SelectItem>
                                <SelectItem value="1">Februari</SelectItem>
                                <SelectItem value="2">Maret</SelectItem>
                                <SelectItem value="3">April</SelectItem>
                                <SelectItem value="4">Mei</SelectItem>
                                <SelectItem value="5">Juni</SelectItem>
                                <SelectItem value="6">Juli</SelectItem>
                                <SelectItem value="7">Agustus</SelectItem>
                                <SelectItem value="8">September</SelectItem>
                                <SelectItem value="9">Oktober</SelectItem>
                                <SelectItem value="10">November</SelectItem>
                                <SelectItem value="11">Desember</SelectItem>
                              </SelectContent>
                            </Select>
                            <Select value={inputYear.toString()} onValueChange={(val) => setInputYear(parseInt(val))}>
                              <SelectTrigger className="w-[90px] h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {availableYears.map(year => (
                                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div style={{ width: '100%', height: 350 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={inputMonthlyData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              <Bar dataKey="IN" fill="#0088FE" name="IN" />
                              <Bar dataKey="OUT" fill="#FF8042" name="OUT" />
                              <Bar dataKey="REP" fill="#FFBB28" name="REP" />
                              <Bar dataKey="COD" fill="#00C49F" name="COD" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Remarks Analysis</CardTitle>
                        <CardDescription>Analisa kondisi kerusakan</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div style={{ width: '100%', height: 300 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={remarksData} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis type="number" />
                              <YAxis dataKey="name" type="category" width={100} />
                              <Tooltip />
                              <Legend />
                              <Bar dataKey="value" fill="#8884d8" name="Jumlah" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>New Parts Analysis</CardTitle>
                        <CardDescription>Analisa penggantian part baru</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div style={{ width: '100%', height: 250 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={newPartsData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              <Bar dataKey="value" fill="#4CAF50" name="Jumlah" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div >
      {/* ================================================================== */}
      {/* HISTORY DETAIL DIALOG */}
      {/* ================================================================== */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              History Log — {historySerial}
            </DialogTitle>
            <DialogDescription>
              Timeline perubahan data trolley dari awal input sampai saat ini
            </DialogDescription>
          </DialogHeader>

          {historyLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span>Memuat history...</span>
            </div>
          ) : historyLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Belum ada history</p>
              <p className="text-sm mt-1">History akan tercatat setelah tabel <code>trolley_history_logs</code> dibuat di database dan data diubah.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">{historyLogs.length} perubahan tercatat</p>

              {/* Timeline */}
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                {historyLogs.map((log, index) => {
                  const actionColors: Record<string, string> = {
                    CREATED: 'bg-green-100 text-green-800 border-green-300',
                    UPDATED: 'bg-blue-100 text-blue-800 border-blue-300',
                    DELETED: 'bg-red-100 text-red-800 border-red-300',
                  };
                  const actionIcons: Record<string, string> = {
                    CREATED: '🟢',
                    UPDATED: '🔄',
                    DELETED: '🔴',
                  };
                  const activeRemarks: string[] = [];
                  if (log.remarks?.bodyPart) activeRemarks.push('Body Part');
                  if (log.remarks?.brakeSystem) activeRemarks.push('Rem Rusak');
                  if (log.remarks?.lockPart) activeRemarks.push('Lock Part');
                  if (log.remarks?.magnetRusak) activeRemarks.push('Magnet Rusak');
                  if (log.remarks?.rodaRusak) activeRemarks.push('Roda Rusak');
                  if (log.remarks?.magnetBaru) activeRemarks.push('Magnet Baru');
                  if (log.remarks?.rodaBaru) activeRemarks.push('Roda Baru');
                  if (log.remarks?.remBaru) activeRemarks.push('Rem Baru');

                  return (
                    <div key={log.id} className="relative pl-10 pb-4">
                      {/* Timeline dot */}
                      <div className="absolute left-2.5 w-3 h-3 rounded-full bg-white border-2 border-gray-400 mt-1.5"></div>

                      <div className="bg-gray-50 rounded-lg p-3 border">
                        {/* Header: Date + Action */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{actionIcons[log.action]}</span>
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {log.maintenanceDate ? new Date(log.maintenanceDate).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                            </span>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium border ${actionColors[log.action] || 'bg-gray-100'}`}>
                            {log.action}
                          </span>
                        </div>

                        {/* Description */}
                        <p className="text-sm text-gray-700 mb-1">{log.description}</p>
                        <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Waktu input: {log.changedAt ? new Date(log.changedAt).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                        </p>

                        {/* Snapshot details */}
                        <div className="grid grid-cols-2 gap-1 text-xs text-gray-500">
                          <span>Status: <strong className={log.status === 'UNSERVICEABLE' ? 'text-red-600' : 'text-green-600'}>{log.status}</strong></span>
                          <span>Type: <strong>{log.type}</strong></span>
                          <span>Input: <strong>{log.inputType}</strong></span>
                          <span>By: <strong>{log.changedBy}</strong></span>
                        </div>

                        {/* Active remarks tags */}
                        {activeRemarks.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {activeRemarks.map((r) => (
                              <span key={r} className="px-1.5 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs border border-yellow-200">
                                {r}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ================================================================== */}
      {/* BARCODE SCANNER DIALOGS */}
      {/* ================================================================== */}
      <BarcodeScanner
        open={formBarcodeScannerOpen}
        onOpenChange={setFormBarcodeScannerOpen}
        onScan={handleFormBarcodeScan}
        title="Scan Barcode - Serial Number"
        description="Scan barcode untuk mengisi Serial Number secara otomatis"
      />
      <BarcodeScanner
        open={searchBarcodeScannerOpen}
        onOpenChange={setSearchBarcodeScannerOpen}
        onScan={handleSearchBarcodeScan}
        title="Scan Barcode - Cari Data"
        description="Scan barcode untuk mencari data berdasarkan Serial Number"
      />

      <Toaster position="top-center" richColors duration={5000} closeButton />
    </div >
  );
}
