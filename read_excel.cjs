const XLSX = require('xlsx');
const workbook = XLSX.readFile('Template_Ceklist_Maintenance_Trolley NEW.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
console.log(JSON.stringify(data.slice(0, 5), null, 2));
