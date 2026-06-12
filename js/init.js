'use strict';
// ============================================================
// APP INITIALIZATION & DEMO DATA SEED
// ============================================================

function seedDemoData() {
  if (!localStorage.getItem('rlhf_seeded_v1')) {
    localStorage.clear();
    localStorage.setItem('rlhf_seeded_v1', 'true');
    location.reload();
    return;
  }
  if (DB.users.all().length > 0) return; // Already seeded

  // Demo Users
  const adminId = Utils.uuid();
  const ann1Id = Utils.uuid();
  const ann2Id = Utils.uuid();
  const ann3Id = Utils.uuid();
  const rev1Id = Utils.uuid();
  const rev2Id = Utils.uuid();
  DB.users.create({ user_id: adminId, full_name: 'System Admin', username: 'admin', password: 'admin123', role: 'admin', email: 'admin@annotateai.com', is_active: true, created_by: adminId, created_date: Utils.now(), last_login: null });
  DB.users.create({ user_id: ann1Id, full_name: 'Priya Sharma', username: 'annotator1', password: 'ann123', role: 'annotator', email: 'priya@example.com', is_active: true, created_by: adminId, created_date: Utils.now(), last_login: null });
  DB.users.create({ user_id: ann2Id, full_name: 'Rahul Mehta', username: 'annotator2', password: 'ann123', role: 'annotator', email: 'rahul@example.com', is_active: true, created_by: adminId, created_date: Utils.now(), last_login: null });
  DB.users.create({ user_id: ann3Id, full_name: 'Sneha Patel', username: 'annotator3', password: 'ann123', role: 'annotator', email: 'sneha@example.com', is_active: true, created_by: adminId, created_date: Utils.now(), last_login: null });
  DB.users.create({ user_id: rev1Id, full_name: 'Dr. Ankit Roy', username: 'reviewer1', password: 'rev123', role: 'reviewer', email: 'ankit@example.com', is_active: true, created_by: adminId, created_date: Utils.now(), last_login: null });
  DB.users.create({ user_id: rev2Id, full_name: 'Meera Nair', username: 'reviewer2', password: 'rev123', role: 'reviewer', email: 'meera@example.com', is_active: true, created_by: adminId, created_date: Utils.now(), last_login: null });

  // Demo Project 1: Sentiment Analysis
  const proj1Id = Utils.uuid();
  DB.projects.create({ project_id: proj1Id, project_name: 'Customer Feedback Sentiment (Q2 2025)', task_type: 'sentiment', label_set: ['Positive', 'Negative', 'Neutral'], instructions: 'Label each customer message as Positive, Negative, or Neutral based on the overall emotional tone. Focus on the overall sentiment, not just individual words.\n\nExamples:\n- "Great service, very happy!" → Positive\n- "The product broke after 2 days." → Negative\n- "Package arrived on Tuesday." → Neutral', status: 'active', deadline: '2025-06-30', created_by: adminId, created_date: Utils.now(), instructions_version: 1 });

  // Demo Project 2: AI Response Evaluation
  const proj2Id = Utils.uuid();
  DB.projects.create({ project_id: proj2Id, project_name: 'AI Chatbot Response Evaluation', task_type: 'ai_evaluation', label_set: ['Correct', 'Partially Correct', 'Incorrect', 'Hallucination'], instructions: 'Evaluate the AI\'s response to the given prompt:\n- Correct: The response is fully accurate and helpful\n- Partially Correct: Some parts are right, but incomplete or slightly off\n- Incorrect: The response is wrong or misleading\n- Hallucination: The AI fabricated facts that do not exist\n\nAlso rate Accuracy, Helpfulness, and Safety on a 1-5 scale.', status: 'active', deadline: '2025-07-15', created_by: adminId, created_date: Utils.now(), instructions_version: 1 });

  // Demo Project 3: Intent Classification
  const proj3Id = Utils.uuid();
  DB.projects.create({ project_id: proj3Id, project_name: 'Customer Support Intent Classification', task_type: 'intent', label_set: ['Complaint', 'Query', 'Praise', 'Feedback'], instructions: 'Classify the customer\'s message into one of these intents:\n- Complaint: Customer is expressing dissatisfaction\n- Query: Customer is asking a question\n- Praise: Customer is complimenting the service\n- Feedback: Customer is providing constructive suggestions', status: 'active', deadline: null, created_by: adminId, created_date: Utils.now(), instructions_version: 1 });

  // Demo Project 4: RLHF Code & Formatting Evaluation
  const proj4Id = Utils.uuid();
  DB.projects.create({ project_id: proj4Id, project_name: 'RLHF Code & Formatting Evaluation', task_type: 'response_comparison', label_set: ['Response A Better', 'Response B Better', 'Both Same', 'Both Bad'], instructions: 'Compare Response A and Response B. Pay close attention to code formatting and factual accuracy. Select the better response, justify your decision, and optionally edit the winner.', status: 'active', deadline: '2025-08-01', created_by: adminId, created_date: Utils.now(), instructions_version: 1 });

  // Demo Items for Project 1
  const sentimentTexts = [
    'I absolutely love this product! Best purchase I have made all year.',
    'Terrible experience. The delivery was late and the item was damaged.',
    'The order arrived as expected. Nothing special.',
    'Customer support was amazing and resolved my issue within minutes.',
    'Completely disappointed. This is not what was advertised.',
    'Decent product for the price. Does what it says.',
    'Outstanding quality! Will definitely order again.',
    'The packaging was terrible and most items were broken.',
    'Received the order on time. Product looks okay.',
    'Best customer service I have ever experienced. Five stars!'
  ];
  const proj1Items = sentimentTexts.map((text, i) => ({ item_id: Utils.uuid(), project_id: proj1Id, original_id: `SENT-${String(i+1).padStart(3,'0')}`, text, prompt: '', ai_response: '', response_a: '', response_b: '', item_status: 'active', is_gold_standard: i === 0 || i === 4, gold_standard_label: i === 0 ? 'Positive' : i === 4 ? 'Negative' : '', uploaded_by: adminId, upload_date: Utils.now() }));
  DB.items.bulkCreate(proj1Items);

  // Demo Items for Project 2
  const aiEvalData = [
    { prompt: 'What is the capital of France?', ai_response: 'The capital of France is Paris. It is also the largest city in France and serves as the country\'s cultural, commercial, and political center.' },
    { prompt: 'Who invented the telephone?', ai_response: 'The telephone was invented by Thomas Edison in 1875 and patented in New York City.' },
    { prompt: 'What is photosynthesis?', ai_response: 'Photosynthesis is a process used by plants and other organisms to convert light energy into chemical energy stored in glucose. It occurs primarily in the chloroplasts using sunlight, water, and carbon dioxide.' },
    { prompt: 'What are black holes?', ai_response: 'Black holes are regions in space where gravity is so strong that nothing, not even light, can escape. They form when massive stars collapse at the end of their life cycle.' },
    { prompt: 'When did World War II end?', ai_response: 'World War II ended in 1943 with the signing of the Paris Peace Treaty between the Allied powers and Japan.' },
  ];
  const proj2Items = aiEvalData.map((d, i) => ({ item_id: Utils.uuid(), project_id: proj2Id, original_id: `AIEVAL-${String(i+1).padStart(3,'0')}`, text: d.prompt, prompt: d.prompt, ai_response: d.ai_response, response_a: '', response_b: '', item_status: 'active', is_gold_standard: false, gold_standard_label: '', uploaded_by: adminId, upload_date: Utils.now() }));
  DB.items.bulkCreate(proj2Items);

  // Demo Items for Project 3
  const intentTexts = [
    'Why has my order not arrived yet? It has been 10 days!',
    'Could you please tell me what payment methods you accept?',
    'Your team was absolutely wonderful in handling my return. Thank you!',
    'I think you should add a dark mode to your app.',
    'This is unacceptable! The product stopped working after 3 days.',
  ];
  const proj3Items = intentTexts.map((text, i) => ({ item_id: Utils.uuid(), project_id: proj3Id, original_id: `INT-${String(i+1).padStart(3,'0')}`, text, prompt: '', ai_response: '', response_a: '', response_b: '', item_status: 'active', is_gold_standard: false, gold_standard_label: '', uploaded_by: adminId, upload_date: Utils.now() }));
  DB.items.bulkCreate(proj3Items);

  // Demo Items for Project 4
  const rlhfData = [
    { prompt: 'Write a Python script to reverse a string.', respA: 'def rev(s): return s[::-1]', respB: '```python\\ndef reverse_string(text):\\n  return "".join(reversed(text))\\n```' },
    { prompt: 'Explain the difference between a list and a tuple in Python. Include a code example.', respA: 'A list is mutable, a tuple is immutable. \\n```python\\nmy_list = [1, 2, 3]\\nmy_tuple = (1, 2, 3)\\nmy_list[0] = 5 # Works\\nmy_tuple[0] = 5 # Error\\n```', respB: 'Lists and tuples are both sequences in Python. Lists use brackets `[]` and tuples use parentheses `()`. Lists can be changed after creation, but tuples cannot.' },
    { prompt: 'Write a professional email declining a job offer because I accepted another position.', respA: "Hi there,\\n\\nI can't take the job. I got a better one. Thanks anyway.\\n\\nBye,", respB: 'Dear Hiring Team,\\n\\nThank you so much for offering me the position. However, I have recently accepted an offer with another company, so I must respectfully decline. I appreciate the time you took to interview me.\\n\\nBest regards,' },
    { prompt: 'Create a markdown table comparing the top 3 planets by size.', respA: '| Planet | Size |\\n|---|---|\\n| Jupiter | Biggest |\\n| Saturn | Big |\\n| Earth | Small |', respB: 'Here is the comparison:\\n\\n| Planet | Equatorial Diameter (km) |\\n| :--- | :--- |\\n| Jupiter | 142,984 |\\n| Saturn | 120,536 |\\n| Uranus | 51,118 |' }
  ];
  const proj4Items = rlhfData.map((d, i) => ({ item_id: Utils.uuid(), project_id: proj4Id, original_id: `RLHF-${String(i+1).padStart(3,'0')}`, text: d.prompt, prompt: d.prompt, ai_response: '', response_a: d.respA, response_b: d.respB, item_status: 'active', is_gold_standard: false, gold_standard_label: '', uploaded_by: adminId, upload_date: Utils.now() }));
  DB.items.bulkCreate(proj4Items);

  // Assign items to annotators (round-robin for proj1)
  const allProj1Items = DB.items.byProject(proj1Id);
  const annotators = [ann1Id, ann2Id, ann3Id];
  const iaList = [];
  allProj1Items.forEach((item, i) => {
    annotators.forEach(annId => {
      iaList.push({ ia_id: Utils.uuid(), item_id: item.item_id, project_id: proj1Id, assigned_to: annId, assigned_by: adminId, assigned_date: Utils.now(), status: 'pending' });
    });
  });
  DB.itemAssignments.bulkCreate(iaList);

  // Assign proj2 items to ann1
  const proj2IAs = proj2Items.map(i => ({ ia_id: Utils.uuid(), item_id: i.item_id, project_id: proj2Id, assigned_to: ann1Id, assigned_by: adminId, assigned_date: Utils.now(), status: 'pending' }));
  DB.itemAssignments.bulkCreate(proj2IAs);

  // Assign proj3 items to ann2
  const proj3IAs = proj3Items.map(i => ({ ia_id: Utils.uuid(), item_id: i.item_id, project_id: proj3Id, assigned_to: ann2Id, assigned_by: adminId, assigned_date: Utils.now(), status: 'pending' }));
  DB.itemAssignments.bulkCreate(proj3IAs);

  // Assign proj4 items (2 to ann1, 2 to ann2)
  const proj4IAsAnn1 = proj4Items.slice(0, 2).map(i => ({ ia_id: Utils.uuid(), item_id: i.item_id, project_id: proj4Id, assigned_to: ann1Id, assigned_by: adminId, assigned_date: Utils.now(), status: 'pending' }));
  const proj4IAsAnn2 = proj4Items.slice(2).map(i => ({ ia_id: Utils.uuid(), item_id: i.item_id, project_id: proj4Id, assigned_to: ann2Id, assigned_by: adminId, assigned_date: Utils.now(), status: 'pending' }));
  DB.itemAssignments.bulkCreate([...proj4IAsAnn1, ...proj4IAsAnn2]);

  // Project assignments
  [ann1Id, ann2Id, ann3Id].forEach(uid => DB.assignments.create({ assignment_id: Utils.uuid(), project_id: proj1Id, user_id: uid, role: 'annotator', assigned_date: Utils.now(), assigned_by: adminId }));
  DB.assignments.create({ assignment_id: Utils.uuid(), project_id: proj2Id, user_id: ann1Id, role: 'annotator', assigned_date: Utils.now(), assigned_by: adminId });
  DB.assignments.create({ assignment_id: Utils.uuid(), project_id: proj3Id, user_id: ann2Id, role: 'annotator', assigned_date: Utils.now(), assigned_by: adminId });
  DB.assignments.create({ assignment_id: Utils.uuid(), project_id: proj4Id, user_id: ann1Id, role: 'annotator', assigned_date: Utils.now(), assigned_by: adminId });
  [rev1Id, rev2Id].forEach(uid => {
    [proj1Id, proj2Id, proj3Id, proj4Id].forEach(pid => DB.assignments.create({ assignment_id: Utils.uuid(), project_id: pid, user_id: uid, role: 'reviewer', assigned_date: Utils.now(), assigned_by: adminId }));
  });

  // Sample completed annotations for proj1 (first 3 items by ann1)
  const sentLabels = ['Positive', 'Negative', 'Neutral', 'Positive', 'Negative'];
  proj1Items.slice(0, 5).forEach((item, i) => {
    const annId = Utils.uuid();
    DB.annotations.create({ annotation_id: annId, item_id: item.item_id, project_id: proj1Id, annotator_id: ann1Id, annotator_label: sentLabels[i], annotator_comment: i === 1 ? 'Clearly dissatisfied customer' : '', confidence_level: 'high', time_taken_seconds: 45, status: i < 3 ? 'submitted' : 'draft', edit_count: 0, original_label: sentLabels[i], created_timestamp: Utils.now(), last_edited_timestamp: Utils.now() });
    if (i < 2) {
      const decision = i === 0 ? 'accepted' : 'modified';
      DB.reviews.create({ review_id: Utils.uuid(), annotation_id: annId, item_id: item.item_id, project_id: proj1Id, reviewer_id: rev1Id, reviewer_label: sentLabels[i], reviewer_comment: i === 1 ? 'Agreed. Strong negative language.' : '', final_label: sentLabels[i], decision, review_timestamp: Utils.now() });
      DB.annotations.update(annId, { status: 'review_complete' });
    }
  });

  // Welcome notification
  [ann1Id, ann2Id, ann3Id].forEach(uid => DB.notifications.create({ notification_id: Utils.uuid(), user_id: uid, type: 'assignment', title: 'Items Assigned to You', message: 'You have been assigned annotation items. Open your queue to get started.', is_read: false, reference_id: '', created_date: Utils.now() }));
  [rev1Id, rev2Id].forEach(uid => DB.notifications.create({ notification_id: Utils.uuid(), user_id: uid, type: 'assignment', title: 'You Are Assigned as Reviewer', message: 'You have been assigned as a reviewer on active projects. Check your review queue.', is_read: false, reference_id: '', created_date: Utils.now() }));
}

// ── MAIN INIT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  seedDemoData();
  if (Auth.restore()) {
    Layout.show();
    Router.navigate('dashboard');
  } else {
    Pages.login();
    document.getElementById('view-login').classList.remove('hidden');
  }
});
