const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// 1. computeVenueBookingStatus
html = html.replace(
    "return 'Available'; // booking is in the past",
    "return 'Done'; // booking is in the past"
);

// 2. Add Action column to all custom-table theads
html = html.replace(/<table class="custom-table">[\s\S]*?<\/thead>/g, (match) => {
    if (match.includes('<th>Action</th>') || match.includes('>Action<')) return match;
    return match.replace(/<\/tr>\s*<\/thead>/, '    <th>Action</th>\n                                        </tr>\n                                    </thead>');
});

// 3. Inject edit/delete td in renderModuleTable
html = html.replace(
    'tr.innerHTML = buildTableRow(moduleKey, record);',
    "tr.innerHTML = buildTableRow(moduleKey, record);\n" +
    "                                const recId2 = record['id'] || record['Id'] || record['ID'] || '';\n" +
    "                                if(recId2) {\n" +
    "                                    const actionsTd = document.createElement('td');\n" +
    "                                    actionsTd.onclick = function(e) { e.stopPropagation(); };\n" +
    "                                    actionsTd.innerHTML = '<button onclick=\"editRecord(\\'' + moduleKey + '\\', \\'' + recId2 + '\\')\" style=\"background:none;border:none;color:#3b82f6;cursor:pointer;margin-right:12px;font-size:16px;\" title=\"Edit\"><i class=\"ri-edit-line\"></i></button>' +\n" +
    "                                                          '<button onclick=\"deleteRecord(\\'' + moduleKey + '\\', \\'' + recId2 + '\\')\" style=\"background:none;border:none;color:#ef4444;cursor:pointer;font-size:16px;\" title=\"Delete\"><i class=\"ri-delete-bin-line\"></i></button>';\n" +
    "                                    tr.appendChild(actionsTd);\n" +
    "                                } else {\n" +
    "                                    tr.innerHTML += '<td></td>';\n" +
    "                                }"
);

// 4. Inject edit/delete td in prependTableRow
html = html.replace(
    'tr.innerHTML = buildTableRow(moduleKey, record);',
    "tr.innerHTML = buildTableRow(moduleKey, record);\n" +
    "                            const recId2 = record['id'] || record['Id'] || record['ID'] || '';\n" +
    "                            if(recId2) {\n" +
    "                                const actionsTd = document.createElement('td');\n" +
    "                                actionsTd.onclick = function(e) { e.stopPropagation(); };\n" +
    "                                actionsTd.innerHTML = '<button onclick=\"editRecord(\\'' + moduleKey + '\\', \\'' + recId2 + '\\')\" style=\"background:none;border:none;color:#3b82f6;cursor:pointer;margin-right:12px;font-size:16px;\" title=\"Edit\"><i class=\"ri-edit-line\"></i></button>' +\n" +
    "                                                      '<button onclick=\"deleteRecord(\\'' + moduleKey + '\\', \\'' + recId2 + '\\')\" style=\"background:none;border:none;color:#ef4444;cursor:pointer;font-size:16px;\" title=\"Delete\"><i class=\"ri-delete-bin-line\"></i></button>';\n" +
    "                                tr.appendChild(actionsTd);\n" +
    "                            } else {\n" +
    "                                tr.innerHTML += '<td></td>';\n" +
    "                            }"
);

// 5. Add editRecord and deleteRecord functions
const scriptToAdd = `
                    // ── EDIT & DELETE HANDLERS ──────────────────────────────────────────────
                    function editRecord(moduleKey, recordId) {
                        const records = appState.moduleRecords[moduleKey] || [];
                        const record = records.find(r => (r.id || r.Id || r.ID) === recordId);
                        if (!record) {
                            showToast('Record not found.');
                            return;
                        }

                        const modalTitle = 'Edit ' + moduleKey.charAt(0).toUpperCase() + moduleKey.slice(1);
                        openGenericModal(modalTitle, moduleKey, null, null);
                        
                        setTimeout(() => {
                            const body = document.getElementById('genericModalBody');
                            const inputs = body.querySelectorAll('input, select, textarea');
                            inputs.forEach(input => {
                                const key = input.name;
                                if (record[key] !== undefined) {
                                    let val = record[key];
                                    if (input.type === 'date' && typeof val === 'string' && val.includes('/')) {
                                        const parts = val.split('/');
                                        if (parts.length === 3) {
                                            val = parts[2] + '-' + parts[0].padStart(2,'0') + '-' + parts[1].padStart(2,'0');
                                        }
                                    }
                                    input.value = val;
                                }
                            });
                            
                            const idInput = document.createElement('input');
                            idInput.type = 'hidden';
                            idInput.name = 'id';
                            idInput.value = recordId;
                            body.appendChild(idInput);
                        }, 50);
                    }

                    function deleteRecord(moduleKey, recordId) {
                        if (!confirm('Are you sure you want to delete this record?')) return;
                        
                        showToast('Deleting record...');
                        google.script.run
                            .withSuccessHandler(function(res) {
                                if (res && res.success) {
                                    showToast('Record deleted successfully!');
                                    if (appState.moduleRecords[moduleKey]) {
                                        appState.moduleRecords[moduleKey] = appState.moduleRecords[moduleKey].filter(r => (r.id || r.Id || r.ID) !== recordId);
                                        renderModuleTable(moduleKey, appState.moduleRecords[moduleKey]);
                                    }
                                } else {
                                    showToast('Failed to delete: ' + (res ? res.error : 'Unknown error'));
                                }
                            })
                            .withFailureHandler(function(err) {
                                showToast('Error deleting record.');
                                console.error(err);
                            })
                            .deleteModuleRecord(moduleKey, recordId);
                    }
`;

html = html.replace('// ── DASHBOARD SCREEN ──', scriptToAdd + '\n                    // ── DASHBOARD SCREEN ──');

// 6. Update saveGenericRecord
html = html.replace(
    'inputs.forEach(input => {',
    "const idInput = body.querySelector('input[name=\"id\"]');\n" +
    "                        if (idInput && idInput.value) {\n" +
    "                            data.id = idInput.value;\n" +
    "                        }\n" +
    "                        inputs.forEach(input => {"
);

html = html.replace(
    /prependTableRow\(currentGenericModule, data\);/g,
    "let isUpdate = false;\n" +
    "                                    if (appState.moduleRecords[currentGenericModule]) {\n" +
    "                                        const idx = appState.moduleRecords[currentGenericModule].findIndex(r => (r.id || r.Id || r.ID) === data.id);\n" +
    "                                        if (idx > -1) {\n" +
    "                                            appState.moduleRecords[currentGenericModule][idx] = Object.assign({}, appState.moduleRecords[currentGenericModule][idx], data);\n" +
    "                                            isUpdate = true;\n" +
    "                                        }\n" +
    "                                    }\n" +
    "                                    if (!isUpdate) {\n" +
    "                                        prependTableRow(currentGenericModule, data);\n" +
    "                                        if (!appState.moduleRecords[currentGenericModule]) {\n" +
    "                                            appState.moduleRecords[currentGenericModule] = [];\n" +
    "                                        }\n" +
    "                                        appState.moduleRecords[currentGenericModule].unshift(data);\n" +
    "                                    } else {\n" +
    "                                        renderModuleTable(currentGenericModule, appState.moduleRecords[currentGenericModule]);\n" +
    "                                    }"
);

html = html.replace(/appState\.moduleRecords\[currentGenericModule\]\.push\(data\);/g, '// push removed, handled above');

fs.writeFileSync('index.html', html, 'utf8');
console.log('index.html successfully updated.');
