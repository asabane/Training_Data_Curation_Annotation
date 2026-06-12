# AnnotateAI — Complete User Documentation

Welcome to AnnotateAI, a fully browser-based, human-in-the-loop training data annotation platform! This platform requires no server installations or complicated setups; it runs directly in your local web browser, with data automatically persisting via browser storage.

---

## 1. Getting Started

### Launching the App
Simply double-click the `index.html` file in your main folder. This will open the application in your default web browser. For the best experience, use a modern browser like Chrome, Edge, or Firefox.

### Default Login Accounts
If you haven't wiped the demo data, you can log in using the following presets (you can click the helper links right on the login screen):
- **Admin**: `admin` / `admin123`
- **Annotator**: `annotator1` / `ann123`
- **Reviewer**: `reviewer1` / `rev123`

*(Note: Data is saved locally in your browser. If you clear your browser cache/cookies, unsaved data will be lost. Always use the **Backup** feature regularly).*

---

## 2. Administrator Guide

The Admin is responsible for creating projects, importing data, assigning users, and monitoring progress.

### A. Understanding the Projects Screen & Icons
When you navigate to **Projects** on the sidebar, you'll see a table of all your datasets. The crucial controls are located in the **Actions** column on the far right. These UI icons open specific management screens:
- **✏️ (Edit Project):** Opens a screen to rename the project, modify the task type, change the label set, or update the instructions for annotators.
- **📤 (Upload Data):** Opens the Data Import screen. Here you can bulk-upload CSV files or manually paste text to populate the project with items to annotate.
- **👥 (Assign Work):** Opens the Assignment Manager screen. This UI allows you to allocate the uploaded items to specific annotators or reviewers using various distribution strategies.

### B. Creating a Project
1. Log in as **Admin**.
2. Go to **Projects** on the left sidebar.
3. Click the **+ New Project** button.
4. Fill in the required details:
    * **Task Type**: Choose from Text Classification, Sentiment, Named Entity Recognition, Response Comparison (RLHF), etc.
    * **Labels**: Press Enter to lock in each label (e.g., *Positive*, *Negative*).
    * **Instructions**: Provide clear guidelines for your annotators.
5. Click **Create Project**. Your project will start in a *Draft* status.

### C. Uploading Data (📤 Screen)
1. On the Projects page, click the **📤 Upload** button next to your project.
2. Prepare a CSV file containing your data. Depending on your task, your CSV headers should ideally include: `id, text, prompt, ai_response, response_a, response_b`.
3. Drag and drop the CSV into the upload zone and follow the prompts to map your CSV columns to the system's fields.
4. The system will automatically detect duplicates and ingest your items.

### D. Assigning Work (👥 Screen)
1. Click the **👥 Assign** button next to your project.
2. Select an Annotator from the dropdown.
3. Choose the Assignment Mode:
    * **All Items**: Gives the user the entire dataset.
    * **First N Items**: Good for batch testing a user.
    * **Round Robin**: Evenly splits unassigned items amongst multiple assigned users.
    * **Overlap (IAA)**: Assigning multiple users to the *same* items will automatically enable Inter-Annotator Agreement (Cohen's/Fleiss' Kappa) statistics.

### E. Managing Quality & System Settings
- **Quality Control**: Use this tab to monitor Inter-Annotator Agreement (IAA), resolve disagreement conflicts using the Conflict Adjudication queue, and manage "Gold Standard" test configurations.
- **Data Management & Backups**: Navigate to **Settings**. Use **Backup All Data** periodically to secure your data in a `.json` file. Use **Restore** if you switch computers.

---

## 3. Annotator Guide

### A. Your Daily Workflow
1. Log in with your **Annotator** account.
2. On the **Dashboard**, you will see your Progress and Pending tasks.
3. Go directly to **My Queue** from the sidebar. High-priority items (like items rejected by a reviewer requiring immediate fixes) will appear first under a "Redo Required" badge.
4. Click any item to launch the Annotation Interface.

### B. The Annotation Interface
1. Read the **Annotation Instructions** panel at the top.
2. Review the Prompt, Text, or AI Responses.
3. Click the most appropriate **Label**.
4. *(Optional)* Provide a comment explaining your choice (highly recommended for ambiguous items) and mark your Confidence level (High/Med/Low).
5. Click **Submit ✓**. The system will seamlessly advance you to the next item.

### C. Corrections
If you realize you made a mistake on an item you just submitted, navigate to **My Submissions**. As long as the item has not yet been processed by a Reviewer, you can click **✏️ Edit** to recall the task and change your label.

---

## 4. Reviewer Guide

The Reviewer ensures dataset quality before it is exported for AI training.

### A. Review Queue
1. Log in with your **Reviewer** account.
2. Open the **Review Queue**. This queue surfaces all items completely annotated by your team. 
3. Click on any item to open the **Review Screen**. If "Blind Review" is enabled by the admin, you will safely review the data without knowing which annotator performed the work to prevent bias.

### B. Making a Decision
You will see the original data snippet side-by-side with the Annotator's chosen label and notes.
- **✅ Accept**: The label is completely accurate.
- **✏️ Modify**: The label was incorrect, but instead of sending it back, you will override the label yourself to fix it immediately. 
- **❌ Reject**: The label is fundamentally wrong. Write constructive feedback in the comment box, and click Reject. This will instantly push a notification to the Annotator and place the item back in their queue to redo.

---

## 5. Exporting & Microsoft Access Integration

Once a dataset is completely reviewed and consensus achieved, an Admin can export the finalized files.

### A. How to Export
1. Log in as an Admin.
2. Navigate to the **Export Center**.
3. Select your desired Project and set the status filter to **Review Complete** (to grab only validated items).
4. Select your format:
    * **CSV**: Best for Excel or Microsoft Access imports.
    * **JSON**: Best for nested data.
    * **JSONL**: Ready-to-go format for huggingface/LLM fine-tuning scripts.
5. Click **Export**.

### B. Microsoft Access
A comprehensive guide exactly detailing how to pipe your CSV exports directly into Microsoft Access tables is located within your workspace at:
`/database/ImportMacros.md`

This guide includes pre-written Microsoft Access VBA scripting for a 1-click import alongside standard QA SQL queries to test your imported matrices.
