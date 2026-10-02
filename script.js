const $=id=>document.getElementById(id);
const today=()=>new Date().toISOString().split("T")[0];
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const priorityWeight={high:3,medium:2,low:1};
const defaultData={tasks:[],xp:0,level:1,streak:0,bestStreak:0,lastCompletion:"",theme:"light",settings:{notifications:false}};
let data=loadData();
let editingId=null;
let calendarDate=new Date();
let selectedCalendarDate=today();
let draggedId=null;
let timerSeconds=1500;
let timerInterval=null;
let selectedFocusId=null;
const achievements=[
{id:"first",icon:"🌱",name:"First Step",desc:"Complete your first task",check:()=>completedCount()>=1},
{id:"five",icon:"⚡",name:"Momentum",desc:"Complete 5 tasks",check:()=>completedCount()>=5},
{id:"ten",icon:"🔥",name:"On Fire",desc:"Complete 10 tasks",check:()=>completedCount()>=10},
{id:"perfect",icon:"🎯",name:"Perfect Day",desc:"Complete every task on a day",check:()=>data.tasks.length>0&&data.tasks.filter(t=>t.date===today()).length>0&&data.tasks.filter(t=>t.date===today()).every(t=>t.completed)},
{id:"streak7",icon:"🏆",name:"Consistent",desc:"Reach a 7-day streak",check:()=>data.bestStreak>=7},
{id:"level5",icon:"🚀",name:"Rising Star",desc:"Reach level 5",check:()=>data.level>=5}
];
function loadData(){
try{return {...defaultData,...JSON.parse(localStorage.getItem("taskflowData"))};}catch{return {...defaultData};}
}
function save(){localStorage.setItem("taskflowData",JSON.stringify(data));}
function completedCount(){return data.tasks.filter(t=>t.completed).length}
function isOverdue(t){return !t.completed&&t.date&&t.date<today()}
function formatDate(date){
if(!date)return "No date";
const d=new Date(date+"T00:00:00");
return d.toLocaleDateString(undefined,{month:"short",day:"numeric"});
}
function escapeHTML(value=""){
return value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}
function toast(message){
const el=$("toast");
el.textContent=message;
el.classList.add("show");
clearTimeout(window.toastTimer);
window.toastTimer=setTimeout(()=>el.classList.remove("show"),2400);
}
function applyTheme(){
document.body.classList.remove("dark","violet");
if(data.theme!=="light")document.body.classList.add(data.theme);
document.querySelectorAll(".theme-option").forEach(b=>b.classList.toggle("active",b.dataset.theme===data.theme));
}
function navigate(view){
document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
$(view+"View").classList.add("active");
document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
const titles={dashboard:"Good day 👋",tasks:"My Tasks",important:"Important Tasks",calendar:"Calendar",analytics:"Analytics",focus:"Focus Mode",settings:"Settings"};
const subs={dashboard:"Plan your work and keep your momentum.",tasks:"Organize everything in one place.",important:"Your starred work.",calendar:"See what's coming next.",analytics:"Understand your productivity patterns.",focus:"Deep work starts here.",settings:"Customize your TASKFLOW experience."};
$("pageTitle").textContent=titles[view];
$("pageSubtitle").textContent=subs[view];
if(view==="dashboard")renderDashboard();
if(view==="tasks")renderTasks();
if(view==="important")renderImportant();
if(view==="calendar")renderCalendar();
if(view==="analytics")renderAnalytics();
if(view==="focus")renderFocus();
}
function updateLevel(){
const level=Math.floor(data.xp/100)+1;
data.level=Math.max(1,level);
const current=data.xp%100;
$("levelValue").textContent=data.level;
$("xpValue").textContent=data.xp+" XP";
$("xpBar").style.width=current+"%";
$("xpNext").textContent=(100-current)+" XP to next level";
$("analyticsXP").textContent=data.xp;
}
function addXP(amount){
data.xp+=amount;
updateLevel();
save();
}
function updateStreak(){
const t=today();
if(data.lastCompletion===t)return;
const yesterday=new Date();
yesterday.setDate(yesterday.getDate()-1);
const y=yesterday.toISOString().split("T")[0];
data.streak=data.lastCompletion===y?data.streak+1:1;
data.bestStreak=Math.max(data.bestStreak,data.streak);
data.lastCompletion=t;
}
function completeTask(id){
const task=data.tasks.find(t=>t.id===id);
if(!task)return;
task.completed=!task.completed;
if(task.completed){
addXP(20);
updateStreak();
toast("Task completed! +20 XP");
}else{
data.xp=Math.max(0,data.xp-20);
toast("Task marked as pending");
}
save();
renderAll();
}
function renderTask(t){
const sub=t.subtasks||[];
const doneSub=sub.filter(s=>s.done).length;
const subProgress=sub.length?Math.round(doneSub/sub.length*100):0;
const overdue=isOverdue(t);
return `<article class="task-card" draggable="true" data-id="${t.id}">
<button class="check ${t.completed?"done":""}" data-action="complete" data-id="${t.id}">${t.completed?"✓":""}</button>
<div class="task-main">
<h4 class="${t.completed?"done":""}">${escapeHTML(t.title)}</h4>
${t.description?`<p>${escapeHTML(t.description)}</p>`:""}
<div class="task-meta">
<span class="chip priority-${t.priority}">${t.priority.toUpperCase()}</span>
<span class="chip">${escapeHTML(t.category)}</span>
${t.date?`<span class="chip ${overdue?"overdue":""}">📅 ${formatDate(t.date)}${t.time?" • "+t.time:""}</span>`:""}
${t.tags.slice(0,3).map(tag=>`<span class="chip">#${escapeHTML(tag)}</span>`).join("")}
</div>
${sub.length?`<div class="subtask-bar"><i style="width:${subProgress}%"></i></div><small style="font-size:8px;color:var(--muted)">${doneSub}/${sub.length} subtasks</small>`:""}
</div>
<div class="task-actions">
<button class="small-action star ${t.important?"active":""}" data-action="star" data-id="${t.id}">★</button>
<button class="small-action" data-action="edit" data-id="${t.id}">✎</button>
<button class="small-action" data-action="delete" data-id="${t.id}">×</button>
</div>
</article>`;
}
function empty(message="No tasks here yet."){
return `<div class="empty-state"><strong>All clear ✨</strong>${message}</div>`;
}
function filteredTasks(){
let tasks=[...data.tasks];
const search=$("searchInput")?.value.toLowerCase().trim()||"";
const status=$("statusFilter")?.value||"all";
const priority=$("priorityFilter")?.value||"all";
const category=$("categoryFilter")?.value||"all";
if(search)tasks=tasks.filter(t=>(t.title+" "+t.description+" "+t.category+" "+t.tags.join(" ")).toLowerCase().includes(search));
if(status==="pending")tasks=tasks.filter(t=>!t.completed);
if(status==="completed")tasks=tasks.filter(t=>t.completed);
if(status==="overdue")tasks=tasks.filter(isOverdue);
if(priority!=="all")tasks=tasks.filter(t=>t.priority===priority);
if(category!=="all")tasks=tasks.filter(t=>t.category===category);
const sort=$("sortSelect")?.value||"custom";
if(sort==="date")tasks.sort((a,b)=>(a.date||"9999").localeCompare(b.date||"9999"));
if(sort==="priority")tasks.sort((a,b)=>priorityWeight[b.priority]-priorityWeight[a.priority]);
if(sort==="recent")tasks.sort((a,b)=>b.createdAt-a.createdAt);
if(sort==="alpha")tasks.sort((a,b)=>a.title.localeCompare(b.title));
return tasks;
}
function renderTasks(){
updateCategoryFilter();
const tasks=filteredTasks();
$("taskCountLabel").textContent=`${tasks.length} task${tasks.length===1?"":"s"}`;
$("allTasks").innerHTML=tasks.length?tasks.map(renderTask).join(""):empty("Try adding a new task or changing your filters.");
bindTaskEvents($("allTasks"));
}
function renderDashboard(){
const total=data.tasks.length;
const completed=completedCount();
const pending=data.tasks.filter(t=>!t.completed).length;
const overdue=data.tasks.filter(isOverdue).length;
$("totalStat").textContent=total;
$("completedStat").textContent=completed;
$("pendingStat").textContent=pending;
$("overdueStat").textContent=overdue;
const todayTasks=data.tasks.filter(t=>t.date===today());
const todayDone=todayTasks.filter(t=>t.completed).length;
const percent=todayTasks.length?Math.round(todayDone/todayTasks.length*100):0;
$("todayPercent").textContent=percent+"%";
$("progressNumber").textContent=percent+"%";
$("progressCircle").style.strokeDashoffset=314-(314*percent/100);
$("todayDone").textContent=todayDone;
$("todayRemaining").textContent=todayTasks.length-todayDone;
$("streakStat").textContent=data.streak;
$("todayTasks").innerHTML=todayTasks.length?todayTasks.slice(0,5).map(renderTask).join(""):empty("No tasks scheduled for today.");
$("upcomingTasks").innerHTML=data.tasks.filter(t=>!t.completed&&t.date&&t.date>=today()).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,5).map(renderTask).join("")||empty("Nothing upcoming.");
bindTaskEvents($("todayTasks"));
bindTaskEvents($("upcomingTasks"));
}
function renderImportant(){
const tasks=data.tasks.filter(t=>t.important);
$("importantTasks").innerHTML=tasks.length?tasks.map(renderTask).join(""):empty("Star tasks to see them here.");
bindTaskEvents($("importantTasks"));
}
function updateCategoryFilter(){
const select=$("categoryFilter");
const current=select.value;
const cats=[...new Set(data.tasks.map(t=>t.category))].sort();
select.innerHTML='<option value="all">All Categories</option>'+cats.map(c=>`<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join("");
select.value=cats.includes(current)?current:"all";
}
function bindTaskEvents(container){
container.querySelectorAll("[data-action]").forEach(btn=>btn.addEventListener("click",e=>{
const id=e.currentTarget.dataset.id;
const action=e.currentTarget.dataset.action;
if(action==="complete")completeTask(id);
if(action==="star"){const t=data.tasks.find(x=>x.id===id);t.important=!t.important;save();renderAll();}
if(action==="edit")openModal(id);
if(action==="delete")deleteTask(id);
}));
container.querySelectorAll(".task-card").forEach(card=>{
card.addEventListener("dragstart",()=>draggedId=card.dataset.id);
card.addEventListener("dragover",e=>e.preventDefault());
card.addEventListener("drop",()=>{
const from=data.tasks.findIndex(t=>t.id===draggedId);
const to=data.tasks.findIndex(t=>t.id===card.dataset.id);
if(from<0||to<0||from===to)return;
const [moved]=data.tasks.splice(from,1);
data.tasks.splice(to,0,moved);
save();
renderAll();
});
});
}
function deleteTask(id){
if(!confirm("Delete this task?"))return;
data.tasks=data.tasks.filter(t=>t.id!==id);
save();
toast("Task deleted");
renderAll();
}
function openModal(id=null){
editingId=id;
$("taskForm").reset();
$("subtaskInputs").innerHTML="";
$("modalTitle").textContent=id?"Edit Task":"Create Task";
if(id){
const t=data.tasks.find(x=>x.id===id);
if(!t)return;
$("editTaskId").value=id;
$("taskTitle").value=t.title;
$("taskDescription").value=t.description;
$("taskDate").value=t.date;
$("taskTime").value=t.time;
$("taskPriority").value=t.priority;
$("taskCategory").value=t.category;
$("taskTags").value=t.tags.join(", ");
(t.subtasks||[]).forEach(s=>addSubtaskInput(s.text));
}else{
$("editTaskId").value="";
$("taskDate").value=today();
}
$("taskModal").classList.remove("hidden");
$("taskTitle").focus();
}
function closeModal(){$("taskModal").classList.add("hidden")}
function addSubtaskInput(value=""){
const row=document.createElement("div");
row.className="subtask-input";
row.innerHTML=`<input value="${escapeHTML(value)}" placeholder="Subtask"><button type="button">×</button>`;
row.querySelector("button").onclick=()=>row.remove();
$("subtaskInputs").appendChild(row);
}
$("taskForm").addEventListener("submit",e=>{
e.preventDefault();
const id=$("editTaskId").value;
const subtasks=[...document.querySelectorAll("#subtaskInputs input")].map(x=>x.value.trim()).filter(Boolean).map(text=>({text,done:false}));
if(id){
const old=data.tasks.find(t=>t.id===id);
const oldSub=old.subtasks||[];
subtasks.forEach(s=>{const match=oldSub.find(x=>x.text===s.text);if(match)s.done=match.done});
Object.assign(old,{title:$("taskTitle").value.trim(),description:$("taskDescription").value.trim(),date:$("taskDate").value,time:$("taskTime").value,priority:$("taskPriority").value,category:$("taskCategory").value,tags:$("taskTags").value.split(",").map(x=>x.trim()).filter(Boolean),subtasks});
toast("Task updated");
}else{
data.tasks.unshift({id:uid(),title:$("taskTitle").value.trim(),description:$("taskDescription").value.trim(),date:$("taskDate").value,time:$("taskTime").value,priority:$("taskPriority").value,category:$("taskCategory").value,tags:$("taskTags").value.split(",").map(x=>x.trim()).filter(Boolean),subtasks,completed:false,important:false,createdAt:Date.now()});
addXP(5);
toast("Task created! +5 XP");
}
save();
closeModal();
renderAll();
});
function renderCalendar(){
const y=calendarDate.getFullYear();
const m=calendarDate.getMonth();
$("calendarTitle").textContent=calendarDate.toLocaleDateString(undefined,{month:"long",year:"numeric"});
const first=new Date(y,m,1);
const last=new Date(y,m+1,0);
const prevLast=new Date(y,m,0).getDate();
const cells=42;
let html="";
for(let i=0;i<cells;i++){
const day=i-first.getDay()+1;
let dateObj;
let muted=false;
if(day<1){dateObj=new Date(y,m-1,prevLast+day);muted=true}else if(day>last.getDate()){dateObj=new Date(y,m+1,day-last.getDate());muted=true}else dateObj=new Date(y,m,day);
const ds=dateObj.toISOString().split("T")[0];
const tasks=data.tasks.filter(t=>t.date===ds);
html+=`<div class="calendar-day ${muted?"muted":""} ${ds===today()?"today":""} ${tasks.length?"has-task":""} ${ds===selectedCalendarDate?"selected":""}" data-date="${ds}"><span class="day-number">${dateObj.getDate()}</span>${tasks.slice(0,2).map(t=>`<span class="day-task">${escapeHTML(t.title)}</span>`).join("")}</div>`;
}
$("calendarGrid").innerHTML=html;
$("calendarGrid").querySelectorAll(".calendar-day").forEach(day=>day.onclick=()=>{selectedCalendarDate=day.dataset.date;renderCalendar()});
const selected=data.tasks.filter(t=>t.date===selectedCalendarDate);
$("calendarTasks").innerHTML=`<div class="panel"><div class="panel-head"><h3>${formatDate(selectedCalendarDate)}</h3></div>${selected.length?`<div class="task-list">${selected.map(renderTask).join("")}</div>`:empty("No tasks on this date.")}</div>`;
bindTaskEvents($("calendarTasks"));
}
function renderAnalytics(){
const total=data.tasks.length;
const completed=completedCount();
$("completionRate").textContent=(total?Math.round(completed/total*100):0)+"%";
$("analyticsStreak").textContent=data.streak+" days";
$("bestStreak").textContent=data.bestStreak+" days";
$("analyticsXP").textContent=data.xp;
const days=[];
for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);days.push(d.toISOString().split("T")[0])}
$("weeklyChart").innerHTML=days.map(d=>{
const count=data.tasks.filter(t=>t.completedAt?.startsWith(d)).length;
const label=new Date(d+"T00:00:00").toLocaleDateString(undefined,{weekday:"short"}).slice(0,3);
return `<div class="bar-wrap"><span class="bar-value">${count}</span><i class="bar" style="height:${Math.max(5,count*18)}%"></i><span class="bar-label">${label}</span></div>`;
}).join("");
const cats={};
data.tasks.forEach(t=>cats[t.category]=(cats[t.category]||0)+1);
const max=Math.max(1,...Object.values(cats));
$("categoryChart").innerHTML=Object.keys(cats).length?Object.entries(cats).map(([cat,count])=>`<div class="category-row"><span>${escapeHTML(cat)}</span><div class="category-track"><i style="width:${count/max*100}%"></i></div><b>${count}</b></div>`).join(""):empty("Create tasks to see analytics.");
renderAchievements();
}
function renderAchievements(){
const unlocked=JSON.parse(localStorage.getItem("taskflowAchievements")||"[]");
$("achievements").innerHTML=achievements.map(a=>{
const is=unlocked.includes(a.id)||a.check();
if(is&&!unlocked.includes(a.id)){unlocked.push(a.id);addXP(25);toast("Achievement unlocked: "+a.name+"! +25 XP")}
return `<div class="achievement ${is?"unlocked":""}"><div class="achievement-icon">${a.icon}</div><strong>${a.name}</strong><span>${a.desc}</span></div>`;
}).join("");
localStorage.setItem("taskflowAchievements",JSON.stringify(unlocked));
}
function renderFocus(){
const pending=data.tasks.filter(t=>!t.completed);
$("focusTaskList").innerHTML=pending.length?pending.map(renderTask).join(""):empty("No pending tasks.");
bindTaskEvents($("focusTaskList"));
if(selectedFocusId){
const t=data.tasks.find(x=>x.id===selectedFocusId);
if(t){$("focusTaskName").textContent=t.title;$("focusTaskDescription").textContent=t.description||"Stay focused and finish this task."}
}
}
function selectFocus(id){
selectedFocusId=id;
const t=data.tasks.find(x=>x.id===id);
if(t){$("focusTaskName").textContent=t.title;$("focusTaskDescription").textContent=t.description||"Stay focused and finish this task."}
}
function updateTimer(){
const min=Math.floor(timerSeconds/60).toString().padStart(2,"0");
const sec=(timerSeconds%60).toString().padStart(2,"0");
$("timerDisplay").textContent=`${min}:${sec}`;
}
function startTimer(){
if(timerInterval)return;
$("timerStart").textContent="Pause";
timerInterval=setInterval(()=>{
timerSeconds--;
updateTimer();
if(timerSeconds<=0){
clearInterval(timerInterval);
timerInterval=null;
$("timerStart").textContent="Start";
addXP(30);
toast("Focus session complete! +30 XP");
if("Notification"in window&&Notification.permission==="granted")new Notification("TASKFLOW",{body:"Focus session completed. Great work!"});
timerSeconds=1500;
updateTimer();
}
},1000);
}
function pauseTimer(){
clearInterval(timerInterval);
timerInterval=null;
$("timerStart").textContent="Start";
}
function renderAll(){
updateLevel();
renderDashboard();
if($("tasksView").classList.contains("active"))renderTasks();
if($("importantView").classList.contains("active"))renderImportant();
if($("calendarView").classList.contains("active"))renderCalendar();
if($("analyticsView").classList.contains("active"))renderAnalytics();
if($("focusView").classList.contains("active"))renderFocus();
applyTheme();
}
document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.view)));
document.querySelectorAll("[data-view-link]").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.viewLink)));
$("heroAddBtn").onclick=()=>openModal();
$("addTaskBtn").onclick=()=>openModal();
$("closeModal").onclick=closeModal;
$("cancelTask").onclick=closeModal;
$("addSubtaskBtn").onclick=()=>addSubtaskInput();
$("prevMonth").onclick=()=>{calendarDate.setMonth(calendarDate.getMonth()-1);renderCalendar()};
$("nextMonth").onclick=()=>{calendarDate.setMonth(calendarDate.getMonth()+1);renderCalendar()};
$("searchInput").oninput=renderTasks;
$("statusFilter").onchange=renderTasks;
$("priorityFilter").onchange=renderTasks;
$("categoryFilter").onchange=renderTasks;
$("sortSelect").onchange=renderTasks;
$("themeBtn").onclick=()=>{
data.theme=data.theme==="light"?"dark":data.theme==="dark"?"violet":"light";
save();
applyTheme();
};
document.querySelectorAll(".theme-option").forEach(b=>b.onclick=()=>{
data.theme=b.dataset.theme;
save();
applyTheme();
});
$("timerStart").onclick=()=>timerInterval?pauseTimer():startTimer();
$("timerReset").onclick=()=>{pauseTimer();timerSeconds=1500;updateTimer()};
document.querySelectorAll(".timer-presets button").forEach(b=>b.onclick=()=>{
pauseTimer();
timerSeconds=Number(b.dataset.minutes)*60;
updateTimer();
});
$("exportBtn").onclick=()=>{
const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
const a=document.createElement("a");
a.href=URL.createObjectURL(blob);
a.download="taskflow-backup.json";
a.click();
URL.revokeObjectURL(a.href);
};
$("importBtn").onclick=()=>$("importFile").click();
$("importFile").onchange=e=>{
const file=e.target.files[0];
if(!file)return;
const reader=new FileReader();
reader.onload=()=>{
try{
const imported=JSON.parse(reader.result);
if(!Array.isArray(imported.tasks))throw new Error();
data={...defaultData,...imported};
save();
renderAll();
toast("Backup imported successfully");
}catch{toast("Invalid backup file")}
};
reader.readAsText(file);
};
async function enableNotifications(){
if(!("Notification"in window)){toast("Notifications are not supported.");return}
const permission=await Notification.requestPermission();
data.settings.notifications=permission==="granted";
save();
toast(permission==="granted"?"Notifications enabled":"Notification permission denied");
}
$("notificationBtn").onclick=enableNotifications;
$("settingsNotificationBtn").onclick=enableNotifications;
$("resetAppBtn").onclick=()=>{
if(!confirm("Reset all TASKFLOW data?"))return;
localStorage.removeItem("taskflowData");
localStorage.removeItem("taskflowAchievements");
location.reload();
};
document.addEventListener("click",e=>{
const task=e.target.closest(".task-card");
if(task&&$("focusView").classList.contains("active")&&!e.target.closest("[data-action]"))selectFocus(task.dataset.id);
});
setInterval(()=>{
if(!data.settings.notifications||!("Notification"in window)||Notification.permission!=="granted")return;
const now=new Date();
data.tasks.filter(t=>!t.completed&&t.date&&t.time).forEach(t=>{
const target=new Date(`${t.date}T${t.time}`);
const diff=target-now;
if(diff>0&&diff<60000&&!t.reminded){
new Notification("TASKFLOW Reminder",{body:t.title});
t.reminded=true;
save();
}
});
},30000);
applyTheme();
updateTimer();
updateLevel();
renderDashboard();
renderAchievements();