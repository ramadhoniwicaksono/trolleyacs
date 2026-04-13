// ============================================================================
// TROLLEY MAINTENANCE API - SUPABASE VERSION
// ============================================================================
// Terhubung langsung ke Supabase (PostgreSQL) — tanpa PHP backend
// ============================================================================

import { supabase } from './supabase'

let serverOnline = true;

// ============================================================================
// HELPER: Fetch all rows with pagination (bypass Supabase 1000 row limit)
// ============================================================================

async function fetchAllRows(
  table: string,
  options?: {
    select?: string;
    filters?: Array<{ column: string; operator: string; value: unknown }>;
    orderBy?: Array<{ column: string; ascending: boolean }>;
  }
): Promise<Record<string, unknown>[]> {
  const PAGE_SIZE = 1000;
  let allData: Record<string, unknown>[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from(table)
      .select(options?.select || '*');

    // Apply filters
    if (options?.filters) {
      for (const f of options.filters) {
        if (f.operator === 'gte') query = query.gte(f.column, f.value);
        else if (f.operator === 'lte') query = query.lte(f.column, f.value);
        else if (f.operator === 'eq') query = query.eq(f.column, f.value);
        else if (f.operator === 'neq') query = query.neq(f.column, f.value);
      }
    }

    // Apply ordering
    if (options?.orderBy) {
      for (const o of options.orderBy) {
        query = query.order(o.column, { ascending: o.ascending });
      }
    }

    // Apply pagination
    query = query.range(from, from + PAGE_SIZE - 1);

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    if (data && data.length > 0) {
      allData = allData.concat(data);
      from += PAGE_SIZE;
      // If we got less than PAGE_SIZE, we've reached the end
      if (data.length < PAGE_SIZE) {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }

  return allData;
}

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
  input: 'IN' | 'OUT' | 'REP';
  posisi: string;
  remarkText: string;
  remarksBarcode: string;
  status: 'SERVICEABLE' | 'UNSERVICEABLE';
  date: string;
  po: string;
  createdAt: string;
}

// ============================================================================
// HELPER: Get user info from localStorage
// ============================================================================

function getUserRole(): string | null {
  try {
    const storedUser = localStorage.getItem('trolley_user');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      return user.role || null;
    }
  } catch {
    return null;
  }
  return null;
}

function getUserUsername(): string {
  try {
    const storedUser = localStorage.getItem('trolley_user');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      return user.username || 'admin';
    }
  } catch {
    return 'admin';
  }
  return 'admin';
}

// ============================================================================
// HELPER: Generate unique ID (sama seperti versi PHP)
// ============================================================================

function generateId(): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let random = '';
  for (let i = 0; i < 7; i++) {
    random += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${timestamp}-${random}`;
}

// ============================================================================
// HELPER: Convert date to YYYY-MM-DD format
// ============================================================================

function convertToDate(dateString?: string | null): string {
  if (!dateString) return new Date().toISOString().split('T')[0];

  try {
    if (dateString.includes('T')) {
      return new Date(dateString).toISOString().split('T')[0];
    }
    const d = new Date(dateString);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

// ============================================================================
// HELPER: Convert DB record → Frontend format
// ============================================================================

function dbToFrontend(record: Record<string, unknown>): MaintenanceRecord {
  return {
    id: record.id as string,
    no: Number(record.no) || 0,
    partNo: (record.part_no as string) || '',
    serial: (record.serial as string) || '',
    type: (record.type as 'FULL' | 'HALF') || 'FULL',
    atlas: (record.atlas as string) || '',
    remarks: {
      lockPart: Boolean(record.remark_lock_part),
      brakeSystem: Boolean(record.remark_brake_system),
      bodyPart: Boolean(record.remark_body_part),
      swivelSingle: Boolean(record.remark_swivel_single),
      magnetRusak: Boolean(record.remark_magnet_rusak),
      magnetBaru: Boolean(record.remark_magnet_baru),
      rodaRusak: Boolean(record.remark_roda_rusak),
      rodaBaru: Boolean(record.remark_roda_baru),
      stikerBarcode: Boolean(record.remark_rem_baru),
      uttReck: Boolean(record.remark_utt_reck),
    },
    from: (record.from_location as string) || '',
    delivery: (record.delivery as string) || '',
    input: (record.input_type as 'IN' | 'OUT' | 'REP') || 'IN',
    posisi: (record.posisi as string) || '',
    remarkText: (record.remark_text as string) || '',
    remarksBarcode: (record.remarks_barcode as string) || '',
    status: (record.status as 'SERVICEABLE' | 'UNSERVICEABLE') || 'SERVICEABLE',
    date: (record.maintenance_date as string) || '',
    po: (record.po as string) || '',
    createdAt: (record.created_at as string) || '',
  };
}

// ============================================================================
// HELPER: Convert Frontend format → DB record
// ============================================================================

function frontendToDb(record: Record<string, unknown>): Record<string, unknown> {
  const remarks = (record.remarks || {}) as Record<string, boolean>;
  return {
    no: record.no ?? 0,
    part_no: record.partNo ?? '',
    serial: record.serial ?? '',
    type: record.type ?? 'FULL',
    atlas: record.atlas ?? '',
    remark_lock_part: remarks.lockPart ?? false,
    remark_brake_system: remarks.brakeSystem ?? false,
    remark_body_part: remarks.bodyPart ?? false,
    remark_swivel_single: remarks.swivelSingle ?? false,
    remark_magnet_rusak: remarks.magnetRusak ?? false,
    remark_magnet_baru: remarks.magnetBaru ?? false,
    remark_roda_rusak: remarks.rodaRusak ?? false,
    remark_roda_baru: remarks.rodaBaru ?? false,
    remark_rem_baru: remarks.stikerBarcode ?? false,
    remark_utt_reck: remarks.uttReck ?? false,
    remark_text: record.remarkText ?? '',
    remarks_barcode: record.remarksBarcode ?? '',
    from_location: record.from ?? '',
    delivery: record.delivery ?? '',
    input_type: record.input ?? 'IN',
    posisi: record.posisi ?? '',
    status: record.status ?? 'SERVICEABLE',
    maintenance_date: convertToDate(record.date as string),
    po: record.po ?? '',
  };
}

// ============================================================================
// HISTORY LOGGING (client-side, sebelumnya di PHP server)
// ============================================================================

const remarkLabels: Record<string, string> = {
  remark_body_part: 'Body Part Rusak',
  remark_brake_system: 'Rem Rusak',
  remark_lock_part: 'Lock Part Rusak',
  remark_magnet_rusak: 'Magnet Rusak',
  remark_roda_rusak: 'Roda Rusak',
  remark_magnet_baru: 'Magnet Baru',
  remark_roda_baru: 'Roda Baru',
  remark_rem_baru: 'Rem Baru',
  remark_swivel_single: 'Swivel Single',
  remark_utt_reck: 'UTT Reck',
};

function buildHistoryDescription(
  record: Record<string, unknown>,
  action: string,
  oldRecord?: Record<string, unknown> | null
): string {
  if (action === 'CREATED') {
    const parts = ['Data baru ditambahkan.'];
    const activeRemarks: string[] = [];
    for (const [key, label] of Object.entries(remarkLabels)) {
      if (record[key]) activeRemarks.push(label);
    }
    if (activeRemarks.length > 0) {
      parts.push('Kondisi: ' + activeRemarks.join(', ') + '.');
    }
    parts.push('Status: ' + (record.status || 'SERVICEABLE') + '.');
    parts.push('Type: ' + (record.type || 'FULL') + '.');
    parts.push('Input: ' + (record.input_type || 'IN') + '.');
    return parts.join(' ');
  }

  if (action === 'DELETED') {
    return 'Data dihapus. Serial: ' + (record.serial || '') + '.';
  }

  if (action === 'UPDATED' && oldRecord) {
    const changes: string[] = [];

    if ((oldRecord.status || '') !== (record.status || '')) {
      changes.push('Status: ' + (oldRecord.status || '-') + ' → ' + (record.status || '-'));
    }
    if ((oldRecord.type || '') !== (record.type || '')) {
      changes.push('Type: ' + (oldRecord.type || '-') + ' → ' + (record.type || '-'));
    }
    if ((oldRecord.input_type || '') !== (record.input_type || '')) {
      changes.push('Input: ' + (oldRecord.input_type || '-') + ' → ' + (record.input_type || '-'));
    }
    if ((oldRecord.from_location || '') !== (record.from_location || '')) {
      changes.push('From: ' + (oldRecord.from_location || '-') + ' → ' + (record.from_location || '-'));
    }
    if ((oldRecord.delivery || '') !== (record.delivery || '')) {
      changes.push('Delivery: ' + (oldRecord.delivery || '-') + ' → ' + (record.delivery || '-'));
    }

    const newRemarks: string[] = [];
    const removedRemarks: string[] = [];
    for (const [key, label] of Object.entries(remarkLabels)) {
      const oldVal = Boolean(oldRecord[key]);
      const newVal = Boolean(record[key]);
      if (!oldVal && newVal) newRemarks.push(label);
      else if (oldVal && !newVal) removedRemarks.push(label);
    }
    if (newRemarks.length > 0) changes.push('Ditambahkan: ' + newRemarks.join(', '));
    if (removedRemarks.length > 0) changes.push('Dihilangkan: ' + removedRemarks.join(', '));

    if (changes.length === 0) return 'Data diupdate (tidak ada perubahan signifikan).';
    return 'Data diupdate. ' + changes.join('. ') + '.';
  }

  return 'Data ' + action.toLowerCase() + '.';
}

async function logHistory(
  record: Record<string, unknown>,
  action: 'CREATED' | 'UPDATED' | 'DELETED',
  oldRecord?: Record<string, unknown> | null
): Promise<void> {
  try {
    const description = buildHistoryDescription(record, action, oldRecord);
    const changedBy = getUserUsername();

    await supabase.from('trolley_history_logs').insert({
      record_id: record.id,
      serial: record.serial,
      action,
      part_no: record.part_no || null,
      type: record.type || null,
      status: record.status || null,
      input_type: record.input_type || null,
      from_location: record.from_location || null,
      delivery: record.delivery || null,
      maintenance_date: record.maintenance_date || null,
      remark_body_part: Boolean(record.remark_body_part),
      remark_brake_system: Boolean(record.remark_brake_system),
      remark_lock_part: Boolean(record.remark_lock_part),
      remark_magnet_rusak: Boolean(record.remark_magnet_rusak),
      remark_roda_rusak: Boolean(record.remark_roda_rusak),
      remark_magnet_baru: Boolean(record.remark_magnet_baru),
      remark_roda_baru: Boolean(record.remark_roda_baru),
      remark_rem_baru: Boolean(record.remark_rem_baru),
      remark_swivel_single: Boolean(record.remark_swivel_single),
      remark_utt_reck: Boolean(record.remark_utt_reck),
      description,
      changed_by: changedBy,
    });
  } catch (e) {
    // Don't fail the main operation if logging fails
    console.error('History log error:', e);
  }
}

// ============================================================================
// MAIN API OBJECT
// ============================================================================

export const maintenanceAPI = {
  // ========================================================================
  // HEALTH CHECK
  // ========================================================================
  async healthCheck(): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('maintenance_records')
        .select('id')
        .limit(1);

      if (error) {
        serverOnline = false;
        return false;
      }

      serverOnline = true;
      return true;
    } catch {
      serverOnline = false;
      return false;
    }
  },

  // ========================================================================
  // GET ALL RECORDS
  // ========================================================================
  async getAll(): Promise<MaintenanceRecord[]> {
    const data = await fetchAllRows('maintenance_records', {
      orderBy: [{ column: 'created_at', ascending: false }],
    });

    return data.map(dbToFrontend);
  },

  // ========================================================================
  // GET RECORDS BY DATE RANGE
  // ========================================================================
  async getByDateRange(startDate: string, endDate: string): Promise<MaintenanceRecord[]> {
    const data = await fetchAllRows('maintenance_records', {
      filters: [
        { column: 'maintenance_date', operator: 'gte', value: startDate },
        { column: 'maintenance_date', operator: 'lte', value: endDate },
      ],
      orderBy: [
        { column: 'maintenance_date', ascending: false },
        { column: 'created_at', ascending: false },
      ],
    });

    return data.map(dbToFrontend);
  },

  // ========================================================================
  // CREATE / UPSERT RECORD
  // ========================================================================
  async create(record: Omit<MaintenanceRecord, 'id' | 'createdAt'>): Promise<{ data: MaintenanceRecord; isNew: boolean }> {
    const dbData = frontendToDb(record as unknown as Record<string, unknown>);

    // Check if serial already exists
    const { data: existing } = await supabase
      .from('maintenance_records')
      .select('*')
      .eq('serial', dbData.serial)
      .maybeSingle();

    if (existing) {
      // AUTO-UPDATE: Serial exists → update
      const { data: updated, error } = await supabase
        .from('maintenance_records')
        .update(dbData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw new Error(error.message);

      // Log history
      await logHistory(updated, 'UPDATED', existing);

      return { data: dbToFrontend(updated), isNew: false };
    }

    // INSERT: New serial
    const id = generateId();
    const insertData = { ...dbData, id };

    const { data: created, error } = await supabase
      .from('maintenance_records')
      .insert(insertData)
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Log history
    await logHistory(created, 'CREATED');

    return { data: dbToFrontend(created), isNew: true };
  },

  // ========================================================================
  // UPDATE RECORD
  // ========================================================================
  async update(id: string, record: Partial<MaintenanceRecord>): Promise<MaintenanceRecord> {
    // Get old record for history comparison
    const { data: oldRecord } = await supabase
      .from('maintenance_records')
      .select('*')
      .eq('id', id)
      .single();

    if (!oldRecord) throw new Error('Record not found');

    const dbData = frontendToDb(record as unknown as Record<string, unknown>);
    // Remove empty serial to avoid unique constraint issues
    if (!dbData.serial) delete dbData.serial;

    const { data: updated, error } = await supabase
      .from('maintenance_records')
      .update(dbData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Log history
    await logHistory(updated, 'UPDATED', oldRecord);

    return dbToFrontend(updated);
  },

  // ========================================================================
  // DELETE SINGLE RECORD
  // ========================================================================
  async delete(id: string): Promise<void> {
    // Get record before deleting for history
    const { data: recordToDelete } = await supabase
      .from('maintenance_records')
      .select('*')
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from('maintenance_records')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);

    // Log history
    if (recordToDelete) {
      await logHistory(recordToDelete, 'DELETED');
    }
  },

  // ========================================================================
  // DELETE ALL RECORDS
  // ========================================================================
  async deleteAll(): Promise<void> {
    const { error } = await supabase
      .from('maintenance_records')
      .delete()
      .neq('id', '');

    if (error) throw new Error(error.message);
    console.log('✅ All records deleted from Supabase');
  },

  // ========================================================================
  // DELETE RECORDS BY DATE
  // ========================================================================
  async deleteByDate(date: string): Promise<number> {
    const { data, error } = await supabase
      .from('maintenance_records')
      .delete()
      .eq('maintenance_date', date)
      .select('id');

    if (error) throw new Error(error.message);
    const deletedCount = data?.length || 0;
    console.log(`✅ Deleted ${deletedCount} records for date ${date}`);
    return deletedCount;
  },

  // ========================================================================
  // STATUS HELPERS
  // ========================================================================
  isUsingFallback(): boolean {
    return !serverOnline;
  },

  isForceOnlineMode(): boolean {
    return true;
  },

  // ========================================================================
  // BATCH IMPORT FOR LARGE DATASETS
  // ========================================================================
  async createBatch(
    records: Omit<MaintenanceRecord, 'id' | 'createdAt'>[],
    onProgress?: (current: number, total: number, successCount: number, errorCount: number) => void
  ): Promise<{ successCount: number; updateCount: number; errorCount: number; errors: string[] }> {
    if (!serverOnline) {
      throw new Error('❌ Batch import requires ONLINE mode! Server connection is required.');
    }

    const BATCH_SIZE = 200;
    const DELAY_BETWEEN_BATCHES = 100;

    let successCount = 0;
    let updateCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    const totalRecords = records.length;
    const totalBatches = Math.ceil(totalRecords / BATCH_SIZE);

    console.log(`🚀 ========================================`);
    console.log(`🚀 STARTING LARGE BATCH IMPORT (Supabase)`);
    console.log(`🚀 ========================================`);
    console.log(`📊 Total records: ${totalRecords}`);
    console.log(`📊 Batch size: ${BATCH_SIZE}`);
    console.log(`📊 Total batches: ${totalBatches}`);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, totalRecords);
      const batch = records.slice(start, end);

      console.log(`\n📤 Batch ${batchIndex + 1}/${totalBatches} | Records ${start + 1}-${end}`);

      try {
        // Process each record in the batch
        for (let i = 0; i < batch.length; i++) {
          const record = batch[i];
          const serial = record.serial;

          if (!serial) {
            errorCount++;
            errors.push(`Record ${start + i + 1}: Serial number kosong`);
            continue;
          }

          try {
            const dbData = frontendToDb(record as unknown as Record<string, unknown>);

            // Check if serial already exists
            const { data: existing } = await supabase
              .from('maintenance_records')
              .select('*')
              .eq('serial', serial)
              .maybeSingle();

            if (existing) {
              // Update existing record
              const { data: updated, error: updateError } = await supabase
                .from('maintenance_records')
                .update(dbData)
                .eq('serial', serial)
                .select()
                .single();

              if (updateError) throw new Error(updateError.message);

              await logHistory(updated, 'UPDATED', existing);
              updateCount++;
            } else {
              // Insert new record
              const id = generateId() + '-' + (start + i);
              const insertData = { ...dbData, id };

              const { data: created, error: insertError } = await supabase
                .from('maintenance_records')
                .insert(insertData)
                .select()
                .single();

              if (insertError) throw new Error(insertError.message);

              await logHistory(created, 'CREATED');
            }

            successCount++;
          } catch (e) {
            errorCount++;
            const errMsg = e instanceof Error ? e.message : 'Unknown error';
            errors.push(`Record ${start + i + 1}: ${errMsg}`);
          }
        }

        console.log(`   ✅ Batch ${batchIndex + 1} processed. Progress: ${((end / totalRecords) * 100).toFixed(1)}%`);

      } catch (e) {
        const errMsg = e instanceof Error ? e.message : 'Unknown error';
        console.error(`   ❌ Batch ${batchIndex + 1} failed: ${errMsg}`);
        errorCount += batch.length;
        errors.push(`Batch ${batchIndex + 1}: ${errMsg}`);
      }

      if (onProgress) {
        onProgress(end, totalRecords, successCount, errorCount);
      }

      if (batchIndex < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }

    console.log(`\n🎉 IMPORT TO SUPABASE COMPLETED!`);
    console.log(`✅ Success: ${successCount}/${totalRecords} (New: ${successCount - updateCount}, Updated: ${updateCount})`);
    console.log(`❌ Errors: ${errorCount}`);

    return { successCount, updateCount, errorCount, errors };
  },

  // ========================================================================
  // HISTORY LOG API
  // ========================================================================
  async getHistoryBySerial(serial: string): Promise<HistoryLog[]> {
    const { data, error } = await supabase
      .from('trolley_history_logs')
      .select('*')
      .eq('serial', serial)
      .order('maintenance_date', { ascending: true })
      .order('changed_at', { ascending: true });

    if (error) throw new Error(error.message);
    return (data || []).map(formatHistoryLog);
  },

  async getAllHistory(limit?: number): Promise<HistoryLog[]> {
    if (limit) {
      // If a specific limit is requested, use a single query
      const { data, error } = await supabase
        .from('trolley_history_logs')
        .select('*')
        .order('maintenance_date', { ascending: false })
        .order('changed_at', { ascending: false })
        .limit(limit);

      if (error) throw new Error(error.message);
      return (data || []).map(formatHistoryLog);
    }

    // No limit → fetch ALL history logs with pagination
    const data = await fetchAllRows('trolley_history_logs', {
      orderBy: [
        { column: 'maintenance_date', ascending: false },
        { column: 'changed_at', ascending: false },
      ],
    });

    return data.map(formatHistoryLog);
  },
};

// ============================================================================
// FORMAT HISTORY LOG
// ============================================================================

function formatHistoryLog(log: Record<string, unknown>): HistoryLog {
  return {
    id: Number(log.id),
    recordId: (log.record_id as string) || '',
    serial: (log.serial as string) || '',
    action: (log.action as 'CREATED' | 'UPDATED' | 'DELETED') || 'CREATED',
    partNo: (log.part_no as string) || '',
    type: (log.type as string) || '',
    status: (log.status as string) || '',
    inputType: (log.input_type as string) || '',
    fromLocation: (log.from_location as string) || '',
    delivery: (log.delivery as string) || '',
    maintenanceDate: (log.maintenance_date as string) || '',
    remarks: {
      bodyPart: Boolean(log.remark_body_part),
      brakeSystem: Boolean(log.remark_brake_system),
      lockPart: Boolean(log.remark_lock_part),
      magnetRusak: Boolean(log.remark_magnet_rusak),
      rodaRusak: Boolean(log.remark_roda_rusak),
      magnetBaru: Boolean(log.remark_magnet_baru),
      rodaBaru: Boolean(log.remark_roda_baru),
      remBaru: Boolean(log.remark_rem_baru),
      swivelSingle: Boolean(log.remark_swivel_single),
      uttReck: Boolean(log.remark_utt_reck),
    },
    description: (log.description as string) || '',
    changedBy: (log.changed_by as string) || '',
    changedAt: (log.changed_at as string) || '',
  };
}

// ============================================================================
// HISTORY LOG INTERFACE
// ============================================================================

export interface HistoryLog {
  id: number;
  recordId: string;
  serial: string;
  action: 'CREATED' | 'UPDATED' | 'DELETED';
  partNo: string;
  type: string;
  status: string;
  inputType: string;
  fromLocation: string;
  delivery: string;
  maintenanceDate: string;
  remarks: {
    bodyPart: boolean;
    brakeSystem: boolean;
    lockPart: boolean;
    magnetRusak: boolean;
    rodaRusak: boolean;
    magnetBaru: boolean;
    rodaBaru: boolean;
    remBaru: boolean;
    swivelSingle: boolean;
    uttReck: boolean;
  };
  description: string;
  changedBy: string;
  changedAt: string;
}