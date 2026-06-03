import fs from 'fs';

const filePath = 'routes/tasks.js';
let content = fs.readFileSync(filePath, 'utf8');

// The place where the task phase is updated is:
// if (phase !== undefined && phase !== task.phase) {
// ...
// changes.push({ type: 'phase_changed', prev: oldPhaseName, next: phaseCheck.name });
// }

// Wait, I need to know where the actual DB update runs so we have the finalized object.
// Towards the end of the route:
// if (updates.length > 0) { ... db.prepare(query).run(...params); ... }

const searchTarget = `      if (updates.length > 0) {
        // Record all changes in activity_log
        const insertLog = db.prepare(\`
          INSERT INTO activity_log (task_id, action, phase, from_phase, to_phase, actor_name, actor_discord_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        \`);
`;

const injection = `      if (updates.length > 0) {
        
        // --- Webhook for Critical Review ---
        if (phase === 'revisao' && task.phase !== 'revisao') {
          try {
            // Check if task has critical labels
            const taskLabels = db.prepare(\`
              SELECT l.name FROM labels l
              JOIN task_labels tl ON tl.label_id = l.id
              WHERE tl.task_id = ?
            \`).all(taskId);
            
            const isCritical = taskLabels.some(l => 
              l.name.toLowerCase().includes('estratégica') || 
              l.name.toLowerCase().includes('estrategica') || 
              l.name.toLowerCase().includes('urgente') || 
              l.name.toLowerCase().includes('bug') || 
              l.name.toLowerCase().includes('crítica') ||
              l.name.toLowerCase().includes('critica')
            );

            if (isCritical) {
              const webhookUrl = process.env.BOT_WEBHOOK_URL || 'http://discord-bot:3005/webhook/critical-review';
              fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  taskId: taskId,
                  title: title || task.title,
                  actor_name: actor_name,
                  assignee_discord_id: assignee_discord_id || task.assignee_discord_id,
                  labels: taskLabels
                })
              }).catch(err => console.error('Failed to notify bot webhook:', err));
            }
          } catch(e) { console.error('Error in webhook logic:', e); }
        }

        // Record all changes in activity_log
        const insertLog = db.prepare(\`
          INSERT INTO activity_log (task_id, action, phase, from_phase, to_phase, actor_name, actor_discord_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        \`);
`;

if (content.includes(searchTarget)) {
  content = content.replace(searchTarget, injection);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ Webhook injection applied successfully');
} else {
  console.log('⚠️ Could not find injection target');
}
