# AnnotateAI — Microsoft Access Integration Guide

## Overview

AnnotateAI exports annotation data as **CSV files** (compatible with Microsoft Access and Excel).  
This guide explains how to import each exported CSV into your Access database.

---

## Step 1 — Export from AnnotateAI

1. Open AnnotateAI in your browser (`index.html`)
2. Log in as **Admin**
3. Go to **Export Center** in the sidebar
4. Select a project (or leave blank for all projects)
5. Choose a status filter if needed
6. Click **⬇️ Export as CSV**
7. Save the file to your `exports\` folder

---

## Step 2 — Import into Access

### Option A — Manual Import (one-time)

1. Open `AnnotationSystem.accdb` in Microsoft Access
2. Click the **External Data** tab → **New Data Source** → **From File** → **Text File**
3. Browse to the exported CSV file
4. Select **Append a copy of the records to the table**
5. Choose the matching table (see mapping below)
6. Follow the import wizard:
   - Delimiter: **Comma**
   - First row contains field names: **Yes**
   - Date format: `YYYY-MM-DD`
7. Click **Finish**

### Option B — VBA Macro (repeatable one-click import)

Open the Access VBA editor (**Alt + F11**) and paste the following macro:

```vba
Sub ImportAnnotations()
    Dim sFile As String
    Dim sTable As String
    
    ' === CHANGE THIS PATH to where your CSV is saved ===
    sFile = "C:\Users\YourName\Downloads\annotateai_export_2026-04-01.csv"
    sTable = "Annotations"
    ' ===================================================
    
    DoCmd.TransferText _
        TransferType:=acImportDelim, _
        SpecificationName:="", _
        TableName:=sTable, _
        FileName:=sFile, _
        HasFieldNames:=True
    
    MsgBox "Import complete into table: " & sTable, vbInformation
End Sub
```

**To run:** Press **F5** inside the VBA editor, or assign the macro to a button on a form.

---

## CSV → Access Table Mapping

| CSV Column | Access Field | Table | Data Type |
|---|---|---|---|
| `id` | `original_id` | Data_Items | Short Text |
| `text` | `text` | Data_Items | Long Text |
| `prompt` | `prompt` | Data_Items | Long Text |
| `ai_response` | `ai_response` | Data_Items | Long Text |
| `response_a` | `response_a` | Data_Items | Long Text |
| `response_b` | `response_b` | Data_Items | Long Text |
| `annotator_name` | `annotator_name` | Annotations | Short Text |
| `annotator_label` | `annotator_label` | Annotations | Short Text |
| `annotator_comment` | `annotator_comment` | Annotations | Long Text |
| `confidence` | `confidence_level` | Annotations | Short Text |
| `annotation_timestamp` | `created_timestamp` | Annotations | Date/Time |
| `reviewer_name` | `reviewer_name` | Reviews | Short Text |
| `reviewer_label` | `reviewer_label` | Reviews | Short Text |
| `reviewer_comment` | `reviewer_comment` | Reviews | Long Text |
| `final_label` | `final_label` | Reviews | Short Text |
| `review_decision` | `decision` | Reviews | Short Text |
| `review_timestamp` | `review_timestamp` | Reviews | Date/Time |
| `project_id` | `project_id` | Annotations | Short Text |

---

## Useful Access Queries

### 1 — Annotation Count per Annotator
```sql
SELECT annotator_name, COUNT(*) AS total_annotations,
       SUM(IIF(review_decision='accepted',1,0)) AS accepted,
       SUM(IIF(review_decision='rejected',1,0)) AS rejected
FROM annotateai_export
GROUP BY annotator_name
ORDER BY total_annotations DESC;
```

### 2 — Label Distribution per Project
```sql
SELECT project_id, final_label, COUNT(*) AS count
FROM annotateai_export
WHERE final_label <> ''
GROUP BY project_id, final_label
ORDER BY project_id, count DESC;
```

### 3 — Agreement Rate (Annotator vs Reviewer)
```sql
SELECT annotator_name,
       COUNT(*) AS reviewed,
       SUM(IIF(annotator_label = final_label, 1, 0)) AS agreed,
       FORMAT(SUM(IIF(annotator_label = final_label, 1, 0)) / COUNT(*), "Percent") AS agreement_rate
FROM annotateai_export
WHERE review_decision <> ''
GROUP BY annotator_name;
```

### 4 — Pending Items (not yet reviewed)
```sql
SELECT id, text, annotator_name, annotator_label, annotation_timestamp
FROM annotateai_export
WHERE review_decision = ''
ORDER BY annotation_timestamp ASC;
```

### 5 — All Rejected Annotations with Reviewer Comments
```sql
SELECT id, text, annotator_name, annotator_label,
       reviewer_name, reviewer_comment, review_timestamp
FROM annotateai_export
WHERE review_decision = 'rejected'
ORDER BY review_timestamp DESC;
```

---

## Activity Log Import

To import the Activity Log separately:

1. In AnnotateAI, go to **Activity Log**
2. Click **⬇️ Export CSV**
3. Import the file into the `Activity_Log` table in Access using the steps above

Activity Log CSV columns: `timestamp, type, user, action, project, detail`

---

## Tips

- **Date fields**: Access may require dates in `DD/MM/YYYY` format. If import fails, open the CSV in Excel first, reformat the date column, and save before importing.
- **Long text**: The `text`, `prompt`, and `ai_response` columns can be very long. Make sure the Access field type is set to **Long Text** (not Short Text).
- **Duplicate prevention**: Before importing, clear the table or enable Access's "Skip records where primary key exists" option to avoid duplicates on re-import.
- **Encoding**: AnnotateAI exports UTF-8 CSV. Access 2016+ handles UTF-8 natively; older versions may need the file saved as ANSI first.
