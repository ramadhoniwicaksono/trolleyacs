// Client-side localStorage storage for maintenance records
const STORAGE_KEY = 'maintenance_records_v1';

interface MaintenanceRecord {
  id: string;
  no: number;
  partNo: string;
  serial: string;
  type: 'FULL' | 'HALF';
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

// Get all records from localStorage
function getRecords(): MaintenanceRecord[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error reading from localStorage:', error);
    return [];
  }
}

// Save records to localStorage
function saveRecords(records: MaintenanceRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
}

export const localStorageAPI = {
  async getAll(): Promise<MaintenanceRecord[]> {
    return getRecords().sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  },

  async getByDateRange(startDate: string, endDate: string): Promise<MaintenanceRecord[]> {
    const allRecords = getRecords();
    return allRecords.filter((record) => {
      const recordDate = new Date(record.date);
      const start = new Date(startDate);
      const end = new Date(endDate);
      return recordDate >= start && recordDate <= end;
    });
  },

  async create(record: Omit<MaintenanceRecord, 'id' | 'createdAt'>): Promise<MaintenanceRecord> {
    const records = getRecords();
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newRecord: MaintenanceRecord = {
      ...record,
      id,
      createdAt: new Date().toISOString(),
    };
    records.push(newRecord);
    saveRecords(records);
    return newRecord;
  },

  async update(id: string, updates: Partial<MaintenanceRecord>): Promise<MaintenanceRecord | null> {
    const records = getRecords();
    const index = records.findIndex(r => r.id === id);

    if (index === -1) {
      return null;
    }

    records[index] = {
      ...records[index],
      ...updates,
      id: records[index].id,
      createdAt: records[index].createdAt,
    };

    saveRecords(records);
    return records[index];
  },

  async delete(id: string): Promise<void> {
    const records = getRecords();
    const filtered = records.filter(r => r.id !== id);
    saveRecords(filtered);
  },

  async deleteAll(): Promise<void> {
    saveRecords([]);
  },

  async deleteByDate(targetDate: string): Promise<number> {
    const records = getRecords();

    // Parse target date (format: YYYY-MM-DD)
    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);

    // Filter records that don't match the target date
    const recordsToKeep = records.filter((record) => {
      const recordDate = new Date(record.date);
      recordDate.setHours(0, 0, 0, 0);
      return recordDate.getTime() !== target.getTime();
    });

    const deletedCount = records.length - recordsToKeep.length;
    saveRecords(recordsToKeep);

    return deletedCount;
  },
};