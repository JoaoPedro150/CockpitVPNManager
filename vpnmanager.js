// Documentação do cockpit:
// https://cockpit-project.org/guide/latest/development.html

// Script que a gente vai seguir para o setup da VPN (caso o OpenVPN não estiver instalado):
// https://raw.githubusercontent.com/angristan/openvpn-install/master/openvpn-install.sh

const LATEST_EASYRSA_VERSION = '3.0.8';

const settingsScreen = document.getElementById('settings_screen');
const clientsScreen = document.getElementById('clients_screen');
const keysScreen = document.getElementById('keys_screen');
const logsScreen = document.getElementById('logs_screen');

const buttonSettingsScreen = document.getElementById('settings_screen_btn');    
      buttonSettingsScreen.onclick = settingsScreenFn;
const buttonClientsScreen = document.getElementById('clients_screen_btn');
      buttonClientsScreen.onclick = clientsScreenFn;
const buttonKeysScreen = document.getElementById('keys_screen_btn');
      buttonKeysScreen.onclick = keysScreenFn;
const buttonLogsScreen = document.getElementById('logs_screen_btn');
      buttonLogsScreen.onclick = logsScreenFn;

const divDashboard = document.getElementById('div-dashboard');
const spanServiceState = document.getElementById('span-service-state');
const btnToggleServiceState = document.getElementById('btn-toggle-service-state');
const btnRestartService = document.getElementById('btn-restart-service')
      btnRestartService.onclick = restartServer;

const inputPort = document.getElementById("input-port");
const inputMaxClients = document.getElementById("input-max-client");
const selectProtocol = document.getElementById("select-proto");
const inputDns = document.getElementById("input-dns");
const selectCompression = document.getElementById("select-compression");

const divVpnNotInstalled = document.getElementById('div-not-installed');
const spanVpnNotInstallednformation = document.getElementById('span-not-installed-information');
const btnInstallVpn = document.getElementById('btn-install-vpn');
      btnInstallVpn.onclick = installOpenVPN;

const btnApplyChanges = document.getElementById('btn-apply');
      btnApplyChanges.onclick = updateServer;

const divSetupingVpn = document.getElementById('div-setuping-vpn');
const setupingVpnOutput = document.getElementById('setuping-output');

const logsOutput = document.getElementById('logs-output');
const errorOutput = document.getElementById('error_output');

serverConf = "";
clientTemplate = "";
serverCertificate = "";
localIp = "";

function drawDashboard(data) {
    hideNextStepScreen();
    hideExecutingStepScreen();
    loadConfig();
    showDashboard();    
}

function loadConfig() {
    let inputs =  [inputDns, inputMaxClients, inputPort, selectProtocol, selectCompression];

    function setServiceState() {
        execute({
            script: ['systemctl show -p ActiveState -p SubState -p Result openvpn-server@server'],
            stream: (output) => {
                serviceStatus = {};

                output.split('\n').forEach(status => {
                    keyValuePair = status.split('=');
                    serviceStatus[keyValuePair[0]] = keyValuePair[1];
                });

                spanServiceState.innerHTML = `${serviceStatus.ActiveState} (${serviceStatus.SubState})`;
                
                if (serviceStatus.Result.match("success")) 
                    spanServiceState.style.color = "limegreen";
                else 
                    spanServiceState.style.color = "red";

                if (serviceStatus.ActiveState.match("^activ"))  
                    btnToggleServiceState.innerHTML = "Stop";
                else 
                    btnToggleServiceState.innerHTML = "Start";
                               
                if (serviceStatus.Result.match("success") && !serviceStatus.ActiveState.match("^activ")) 
                    spanServiceState.style.color = "red";
                

                btnToggleServiceState.onclick = () => {
                    spanServiceState.innerHTML = `${btnToggleServiceState.innerHTML}ing...`;
                    spanServiceState.style.color = "black";
                    execute({command: ['systemctl', btnToggleServiceState.innerHTML.toLowerCase(), 'openvpn-server@server'], next:setServiceState});
                }    
            }
        });
    }    

    function getConfig(input, regex) {
        input.value = serverConf.match(new RegExp(regex))[1];
    }

    function getLimitedConfig(input, regex) {
        let match = serverConf.match(new RegExp(regex));
    
        if (match == undefined) {
            input.value = "null";
        }
        else {
            input.value = match[1];
        }
    }
    
    function getDns() {
        inputDns.value = "";
    
        let match = serverConf.match(/^push "dhcp-option DNS \d+\.\d+\.\d+\.\d+"\n?/gm);
        match.forEach(element => {
            let match = element.match(/push "dhcp-option DNS (\d+\.\d+\.\d+\.\d+)"/);
    
            inputDns.value += match[1] + ", ";
        });
    
        inputDns.value = inputDns.value.replace(/, $/g,'');
    }

    execute({
        command: ["cat", "/etc/openvpn/server.conf"],
        stream: (data) => {
            serverConf = data;
            setServiceState();
            getConfig(inputPort, "port ([0-9]*)");
            getConfig(inputMaxClients, "max-clients ([0-9]*)");
            getConfig(selectProtocol,);
            getLimitedConfig(selectCompression, /^compress (lz4-v2|lz4|lzo)$/m);
            getLimitedConfig(selectProtocol, /^proto (udp|tcp)$/m);
            getDns();
            inputs.forEach(input => {
                input.disabled = false;
            });
            btnApplyChanges.disabled = false;
        }
    });
    execute({
        script: "ip -4 addr | sed -ne 's|^.* inet \\([^/]*\\)/.* scope global.*$|\\1|p' | head -1",
        stream: (data) => {
            console.log(data);
            localIp = data.replace('\n','');
        }
    });
    execute({
        command: ["cat", "/etc/openvpn/client-template.txt"],
        stream: (data) => {
            clientTemplate = data;
        }
    });
    execute({
        command: ["cat", "/etc/openvpn/easy-rsa/pki/ca.crt"],
        stream: (data) => {
            serverCertificate = data
        }
    });
}


function restartServer() {
    spanServiceState.innerHTML = "Restarting...";
    spanServiceState.style.color = "black";
    let inputs =  [inputDns, inputMaxClients, inputPort, selectProtocol, selectCompression];

    inputs.forEach(input => {
        input.disabled = true;
        input.value = "...";
    });
    
    execute({
        command: ['systemctl', 'restart', 'openvpn-server@server'],
        next: loadConfig
    });
}

function updateServer() {
    btnApplyChanges.disabled = true;
    clientTemplate = clientTemplate.replace(/^proto (udp|tcp)$/m, `proto ${selectProtocol.value}`);
    clientTemplate = clientTemplate.replace(/^remote .+ \d+$/m, `remote ${localIp} ${inputPort.value}`)

    serverConf = serverConf.replace(/^proto (udp|tcp)$/m, `proto ${selectProtocol.value}`);
    serverConf = serverConf.replace(/^port [0-9]*$/m, `port ${inputPort.value}`);
    
    serverConf = serverConf.replace(/^max-clients ([0-9]*)$/m, `max-clients ${inputMaxClients.value}`);

    function changeCompress() {
        let disabled = selectCompression.value === "null";

        if (disabled) {
            selectCompression.value = "lz4-v2";
        }

        serverConf = serverConf.replace(/^;?compress (lz4-v2|lz4|lzo)$/m, `${disabled ? ";" : ""}compress ${selectCompression.value}`);
        serverConf = serverConf.replace(/^;?push "compress (lz4-v2|lz4|lzo)"$/m, `${disabled ? ";" : ""}push "compress ${selectCompression.value}"`);
    }

    function changeDns() {
        let dns = inputDns.value.split(',');
        let dns1 = dns[0]?.trim();
        let dns2 = dns[1]?.trim();
    
        serverConf = serverConf.replace(/^push "dhcp-option DNS \d+\.\d+\.\d+\.\d+"\n?/gm, "");
    
        if (dns1 != undefined)
            serverConf += `push "dhcp-option DNS ${dns1}"\n`;
        if (dns2 != undefined)
            serverConf += `push "dhcp-option DNS ${dns2}"`;
    }

    changeDns();
    changeCompress();

    execute({
        script: `echo -n '${clientTemplate}' > /etc/openvpn/client-template.txt`,
        next: restartServer
    });
    execute({
        script: `echo -n '${serverConf}' > /etc/openvpn/server.conf`,
        next: restartServer
    });
}

function isOpenVpnInstalled() {
    function installOpenVpnMessage(data) {
        function buildMessage(user) {
            if (user.id != 0) {
                spanVpnNotInstallednformation.innerHTML += ' You need to be logged as root to install it.';
            }
            else {
                btnInstallVpn.onclick = installOpenVPN;
                btnInstallVpn.innerHTML = 'Install OpenVPN';
            }
    
            showNextStepScreen();
        }
        
        cockpit.user().then(buildMessage);
    }

    cockpit.spawn(['test', '-e', '/etc/openvpn/server.conf'])
        .then(drawDashboard)
        .catch(installOpenVpnMessage); 
}

function installOpenVPN() {
    hideNextStepScreen();
    showExecutingStepScreen();
    
    cockpit.script("./installation.sh", {
         directory: "/usr/share/cockpit/vpnmanager" 
    })
    .stream((output) => {
        writeOutput(output);
        setTimeout(() => window.scrollBy(0,100000),10);
    })
    .then(drawDashboard)
    .catch(writeError);
}

// Não tenho ctz se aqui é o lugar correto para executar as primeiras verificações.
// Não procurei nada sobre OnDocumentLoaded()
cockpit.transport.wait(function() { 
    hideDashboard();
    hideExecutingStepScreen();
    isOpenVpnInstalled();
});

function settingsScreenFn(){
    settingsScreen.style.setProperty("display", "block", "important");
    clientsScreen.style.setProperty("display", "none", "important");
    keysScreen.style.setProperty("display", "none", "important");
    logsScreen.style.setProperty("display", "none", "important");
}

var isListen = false;
function logsScreenFn() {
    settingsScreen.style.setProperty("display", "none", "important");
    clientsScreen.style.setProperty("display", "none", "important");
    keysScreen.style.setProperty("display", "none", "important");
    logsScreen.style.setProperty("display", "block", "important");
    if (!isListen) {
        isListen = true;
        execute({
            script: "journalctl -u openvpn-server@server -f",
            stream: (output) => {
                logsOutput.innerHTML += output;
                
                setTimeout(() => window.scrollBy(0,100000),10);
            }
        });
    }
    window.scrollBy(0,100000)
}

const tableClients = document.getElementById('table-clients');
const btnUpdateTableClients = document.getElementById('btn-update-table-clients');
      btnUpdateTableClients.onclick = reloadClients;
function clientsScreenFn(){
    settingsScreen.style.setProperty("display", "none", "important");
    clientsScreen.style.setProperty("display", "block", "important");
    keysScreen.style.setProperty("display", "none", "important");
    logsScreen.style.setProperty("display", "none", "important");
    reloadClients();
}

function reloadClients() {
    execute({
        script: "cat /var/log/openvpn/status.log",
        stream: (output) => {
            iterator = output.matchAll(/^CLIENT_LIST,(.*),(.*),(.*),(.*),(.*),(.*),(.*),(.*),(.*),(.*),(.*)/gm)
            match = iterator.next();

            tableClients.innerHTML = `<tr>
            <th>Client</th>
            <th>Real IP</th>
            <th>Virtual IP</th>
            <th>Bytes Received</th>
            <th>Bytes Sent</th>
            <th>Connected Since</th>
          </tr>`;

            while (match.value != undefined) {
                tableClients.innerHTML = tableClients.innerHTML.replace('</tr>',`</tr><tr><td>${match.value[1]}</td><td>${match.value[2]}</td><td>${match.value[3]}</td><td>${match.value[5]}</td><td>${match.value[6]}</td><td>${match.value[7]}</td></tr>`)
                match = iterator.next();
            }   
        }
    });
}

const keysTable = document.getElementById('keys-table');
function keysScreenFn(){
    settingsScreen.style.setProperty("display", "none", "important");
    clientsScreen.style.setProperty("display", "none", "important");
    keysScreen.style.setProperty("display", "block", "important");
    logsScreen.style.setProperty("display", "none", "important");
    updateKeysTable();
}
function updateKeysTable() {
    execute({
        script: "tail -n +2 /etc/openvpn/easy-rsa/pki/index.txt",
        stream: (output) => {
            keysTable.innerHTML = `<tr>
                <th>Client Name</th>
                <th>Actions</th>
                </tr>`;
            iterator = output.matchAll(/^V.+\/CN=(.+)$/gm)
            match = iterator.next();

            while (match.value != undefined) {
                keysTable.innerHTML = keysTable.innerHTML.replace('</tr>',
                `</tr>
                    <tr>
                    <td>
                        ${match.value[1]}
                    </td>
                    <td>
                        <button id="btn-export-ovpn-${match.value[1]}">Download .ovpn</button>
                        <button class="removebtn" id="btn-remove-key-${match.value[1]}">Remove</button>
                    </td>
                </tr>`)
                match = iterator.next();
            }   

            iterator = output.matchAll(/^V.+\/CN=(.+)$/gm)
            match = iterator.next();

            while (match.value != undefined) {
                document.getElementById(`btn-export-ovpn-${match.value[1]}`).onclick = downloadOvpn;
                document.getElementById(`btn-remove-key-${match.value[1]}`).onclick = removeClient;
                match = iterator.next();
            }   
        }
    });
}
function downloadOvpn(ev) {
    client = ev.srcElement.id.match(/btn-export-ovpn-(.+)/)[1];
    ovpn = clientTemplate;
    ovpn += "\n<ca>\n" + serverCertificate + "</ca>";

    execute({
        command: ["cat", `/etc/openvpn/easy-rsa/pki/issued/${client}.crt`],
        stream: (data) => {
            ovpn += "\n<cert>\n" + data.match(/-----BEGIN CERTIFICATE-----.+-----END CERTIFICATE-----/s)[0] + "\n</cert>";
        },
        next: () => execute({
            command: ["cat", `/etc/openvpn/easy-rsa/pki/private/${client}.key`],
            stream: (data) => {
                ovpn += "\n<key>\n" + data + "</key>";
            },  
            next: () => execute({
                command: ["cat", `/etc/openvpn/tls-crypt.key`],
                stream: (data) => {
                    ovpn += "\n<tls-crypt>\n" + data + "</tls-crypt>";
                },
                next: () =>{
                    var element = document.createElement('a');
                    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(ovpn));
                    element.setAttribute('download', `${client}.ovpn`);
                
                    element.style.display = 'none';
                    document.body.appendChild(element);
                
                    element.click();
                
                    document.body.removeChild(element);
                }
            })
        })
    })
}
function removeClient(ev) {
    client = ev.srcElement.id.match(/btn-remove-key-(.+)/)[1];
    execute({
        script: `cd /etc/openvpn/easy-rsa/ || return
        ./easyrsa --batch revoke "${client}"
        ./easyrsa gen-crl
        rm -f /etc/openvpn/crl.pem
        cp /etc/openvpn/easy-rsa/pki/crl.pem /etc/openvpn/crl.pem
        chmod 644 /etc/openvpn/crl.pem
        sed -i "/^${client},.*/d" /etc/openvpn/ipp.txt`,
        next: () => { updateKeysTable(); restartServer(); }
    });
}

const inputClientName = document.getElementById('client-name');
const btnAddClient = document.getElementById('btn-add-key');
btnAddClient.onclick = () => {
    execute({
        script: `./easyrsa build-client-full "${inputClientName.value}" nopass`,
        directory: '/etc/openvpn/easy-rsa',
        enableLog: true,
        next: updateKeysTable
    });

    inputClientName.value = ""; 
};

// Utils.js
function hideDashboard() {
    clientsScreen.style.display = 'none';
    keysScreen.style.display = 'none';
    divDashboard.style.display = 'none';
}
function showDashboard() {
    divDashboard.style.display = 'block';
}
function hideNextStepScreen() {
    divVpnNotInstalled.style.setProperty("display", "none", "important");
}
function showNextStepScreen() {
    divVpnNotInstalled.style.display = 'block';
}
function showExecutingStepScreen() {
    divSetupingVpn.style.display = 'block';
}
function hideExecutingStepScreen() {
    divSetupingVpn.style.display = 'none';
}
function clearOutput() {
    setupingVpnOutput.innerHTML = '';
}
function writeOutput(data) {
    setupingVpnOutput.append(document.createTextNode(data));
}
function writeError(data) {
    console.error(data);
    errorOutput.innerHTML += `<span style="color:red">${data}</span>`;
}

function execute(args) {
    if (args.stream == undefined) {
        args.stream = (data) => console.log(data);
    }

    let firstArgs;
    let func;
    
    if (args.command != undefined) {
        firstArgs = args.command;
        func = cockpit.spawn;
    }
    else if (args.script != undefined) {
        firstArgs = args.script;
        func = cockpit.script;
    }

    let secondArgs = {}; 
    if (args.directory != undefined) {
        secondArgs.directory = args.directory;
    }

    if (args.enableLog) {
        console.log(firstArgs);
    }

    func(firstArgs, secondArgs)
        .stream(args.stream)
        .then(args.next)
        .catch((data) => console.error(data));
}   