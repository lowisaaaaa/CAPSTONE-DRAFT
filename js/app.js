/* ========= Session & Constants ========= */
const LS = {
  role: "hp_role",
  email: "hp_email",
  barangay: "hp_barangay",
  sector: "hp_sector",
  dataPrefix: "hp_children_"
};

const VACCINES = [
  "BCG","HEPA B","PENTA 1","PENTA 2","PENTA 3",
  "OPV1","OPV2","OPV3",
  "IPV1","IPV2",
  "PCV1","PCV2","PCV3",
  "MCV1","MCV2"
];

const BARANGAYS = [
  "Abiacao","Bagong Tubig","Balagtasin","Balite","Banoyo",
  "Boboy","Bonliw","Calumpang East","Calumpang West",
  "Dulangan","Durungao","Locloc","Luya","Mahabang Parang",
  "Manggahan","Muzon","San Antonio","San Isidro","San Jose",
  "San Martin","Santa Monica","Taliba","Talon","Tejero",
  "Tungal","Población"
];

const SECTORS = ["Sector A", "Sector B", "Sector C"];

function storageKeyFor(b, s) {
  return `${LS.dataPrefix}${b}__${s}`;
}

/* ========= Utilities ========= */
function parseCSV(text) {
  const rows = [];
  let i=0,f="",r=[],q=false;
  while(i<text.length){
    const c=text[i];
    if(c==='"'){ if(q && text[i+1]==='"'){ f+='"'; i++; } else q=!q; }
    else if(c===',' && !q){ r.push(f.trim()); f=""; }
    else if((c==='\n'||c==='\r') && !q){ if(f.length||r.length){ r.push(f.trim()); rows.push(r); f=""; r=[];} if(c==='r' && text[i+1]==='\n')i++; }
    else f+=c; i++;
  }
  if(f.length||r.length){ r.push(f.trim()); rows.push(r);}
  return rows.filter(r=>r.length && r.some(x=>x!==""));
}

function toCSV(rows){
  return rows.map(r=>r.map(v=>{
    const s=v==null?"":String(v);
    return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
  }).join(',')).join('\n');
}

function download(filename,mime,content){
  const blob=new Blob([content],{type:mime});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=filename;a.click();
  URL.revokeObjectURL(url);
}

function tableToXls(filename, tableElem) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${tableElem.outerHTML}</body></html>`;
  download(filename, "application/vnd.ms-excel", html);
}

/* ========= Login Handling ========= */
function loginHandler() {
  const users = {
    "mho@gmail.com": { password: "password", role: "MHO", redirect: "mho_dashboard.html" },
    // BNS + BHW Example
    "abiacao@gmail.com": { password: "password", role: "BNS", barangay: "Abiacao", redirect: "bns_dashboard.html" },
    "abiacaobhw1@gmail.com": { password: "password", role: "BHW", barangay: "Abiacao", redirect: "bhw_dashboard.html" },
    "bagongtubig@gmail.com": { password: "password", role: "BNS", barangay: "Bagong Tubig", redirect: "bns_dashboard.html" },
    "bagongtubighw1@gmail.com": { password: "password", role: "BHW", barangay: "Bagong Tubig", redirect: "bhw_dashboard.html" },
    // Add all other users...
  };

  document.getElementById("loginForm")?.addEventListener("submit", function(e) {
    e.preventDefault();
    const email = document.getElementById("email").value.toLowerCase();
    const password = document.getElementById("password").value;

    const user = users[email];
    if (user && user.password === password) {
      localStorage.setItem(LS.role, user.role);
      localStorage.setItem(LS.email, email);
      if(user.barangay) localStorage.setItem(LS.barangay,user.barangay);
      if(user.sector) localStorage.setItem(LS.sector,user.sector);
      window.location.href = user.redirect;
    } else {
      document.getElementById("error").style.display="block";
    }
  });
}

/* ========= Table Rendering ========= */
function renderTable(tbody, data) {
  tbody.innerHTML = "";
  data.forEach((row,index)=>{
    const tr=document.createElement("tr");
    tr.innerHTML = `
      <td>${row["Child Name"]||""}</td>
      <td>${row["Age"]||""}</td>
      <td>${row["Parent Name"]||""}</td>
      <td>${row["Barangay"]||""}</td>
      <td>${row["Sector"]||""}</td>
      ${VACCINES.map(v=>`<td><span class="badge ${row[v]==="Accepted"?"accepted":"needed"}">${row[v]||"Needed"}</span></td>`).join("")}
      <td>
        <button class="action-btn edit-btn" onclick="editRow(this,${index})">Edit</button>
        <button class="action-btn delete-btn" onclick="deleteRow(${index})">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function editRow(button,index){
  const tr = button.closest("tr");
  const isEditing = button.innerText==="Save";

  if(isEditing){
    const cells=tr.querySelectorAll("td");
    const updated = {
      "Child Name": cells[0].innerText.trim(),
      "Age": cells[1].innerText.trim(),
      "Parent Name": cells[2].innerText.trim(),
      "Barangay": cells[3].innerText.trim(),
      "Sector": cells[4].innerText.trim()
    };
    let col=5;
    VACCINES.forEach(v=>{ updated[v]=cells[col].innerText.trim(); col++; });
    childrenData[index]=updated;
    localStorage.setItem(storageKeyFor(localStorage.getItem(LS.barangay),localStorage.getItem(LS.sector)),JSON.stringify(childrenData));
    renderTable(document.querySelector("#childrenTable tbody"), childrenData);
  } else {
    tr.querySelectorAll("td").forEach((c,i)=>{ if(i<cells.length-1) c.contentEditable=true; });
    button.innerText="Save";
  }
}

function deleteRow(index){
  childrenData.splice(index,1);
  localStorage.setItem(storageKeyFor(localStorage.getItem(LS.barangay),localStorage.getItem(LS.sector)),JSON.stringify(childrenData));
  renderTable(document.querySelector("#childrenTable tbody"), childrenData);
}

/* ========= Aggregation ========= */
function aggregateData() {
  const summary={ totalChildren: childrenData.length, barangayCounts:{}, vaccineStatus:{} };
  VACCINES.forEach(v=>summary.vaccineStatus[v]={Accepted:0,Needed:0});
  childrenData.forEach(c=>{
    const brgy=c["Barangay"]||"Unknown";
    summary.barangayCounts[brgy]=(summary.barangayCounts[brgy]||0)+1;
    VACCINES.forEach(v=>{ summary.vaccineStatus[v][c[v]==="Accepted"?"Accepted":"Needed"]++; });
  });
  return summary;
}

function renderSummary() {
  const s=aggregateData();
  document.getElementById("totalChildren").textContent=s.totalChildren;
  const brgyDiv=document.getElementById("barangaySummary"); brgyDiv.innerHTML="";
  Object.entries(s.barangayCounts).forEach(([b,c])=>{ const p=document.createElement("p"); p.textContent=`${b}: ${c}`; brgyDiv.appendChild(p); });
  const vacDiv=document.getElementById("vaccineSummary"); vacDiv.innerHTML="";
  Object.entries(s.vaccineStatus).forEach(([v,c])=>{ const p=document.createElement("p"); p.textContent=`${v} → Accepted: ${c.Accepted}, Needed: ${c.Needed}`; vacDiv.appendChild(p); });
}

/* ========= Page Bootstrap ========= */
document.addEventListener("DOMContentLoaded",()=>{
  document.getElementById('y').textContent=new Date().getFullYear();
  loginHandler();

  const page = location.pathname.split("/").pop();
  if(page==="bns_dashboard.html"||page==="bhw_dashboard.html"){
    const barangay = localStorage.getItem(LS.barangay)||"";
    const sector = localStorage.getItem(LS.sector)||"Sector A";
    const key = storageKeyFor(barangay,sector);
    window.childrenData = JSON.parse(localStorage.getItem(key)||"[]");
    renderTable(document.querySelector("#childrenTable tbody"), childrenData);
    renderSummary();

    // import CSV
    document.getElementById("importBtn")?.addEventListener("click", async ()=>{
      const file = document.getElementById("fileInput").files[0];
      if(!file){ alert("Select a CSV file first."); return; }
      const text=await file.text();
      const rows=parseCSV(text);
      const hdr=rows[0].map(h=>h.trim().toLowerCase());
      const idx={
        child: hdr.indexOf("child name"),
        age: hdr.indexOf("age"),
        parent: hdr.indexOf("parent name"),
        barangay: hdr.indexOf("barangay"),
        sector: hdr.indexOf("sector"),
      };
      if(Object.values(idx).some(v=>v<0)){ alert("Missing required columns."); return; }
      const list=[];
      for(let i=1;i<rows.length;i++){
        const r=rows[i]; if(!r?.length) continue;
        list.push({
          "Child Name": r[idx.child]||"",
          "Age": r[idx.age]||"",
          "Parent Name": r[idx.parent]||"",
          "Barangay": r[idx.barangay]||barangay,
          "Sector": r[idx.sector]||sector
        });
      }
      childrenData=list;
      localStorage.setItem(key,JSON.stringify(childrenData));
      renderTable(document.querySelector("#childrenTable tbody"),childrenData);
      renderSummary();
      alert("Imported successfully.");
    });

    // export CSV
    document.getElementById("downloadCsv")?.addEventListener("click",()=>{
      const rows=[["Child Name","Age","Parent Name","Barangay","Sector",...VACCINES]];
      childrenData.forEach(r=>rows.push([r["Child Name"],r["Age"],r["Parent Name"],r["Barangay"],r["Sector"],...VACCINES.map(v=>r[v]||"Needed")]));
      download(`${barangay}_${sector}.csv`,"text/csv",toCSV(rows));
    });

    // export XLS
    document.getElementById("downloadXls")?.addEventListener("click",()=>{
      tableToXls(`${barangay}_${sector}.xls`,document.getElementById("childrenTable"));
    });
  }
});
