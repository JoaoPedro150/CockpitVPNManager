// Documentação do cockpit:
// https://cockpit-project.org/guide/latest/development.html

// Script que a gente vai seguir para o setup da VPN (caso o OpenVPN não estiver instalado):
// https://raw.githubusercontent.com/angristan/openvpn-install/master/openvpn-install.sh

const LATEST_EASYRSA_VERSION = '3.0.8';

const settingsScreen = document.getElementById('settings_screen');
const clientsScreen = document.getElementById('clients_screen');
const keysScreen = document.getElementById('keys_screen');

const divDashboard = document.getElementById('div-dashboard');
const spanServiceStatus = document.getElementById('span-service-status');
const btnToggleServiceState = document.getElementById('btn-toggle-service-state');
const btnRestartService = document.getElementById('btn-restart-service')
      btnRestartService.onclick = restartServer;

const inputPort = document.getElementById("input-port");
const btnChangePort = document.getElementById("btn-change-port");
      btnChangePort.onclick =  () => changeConfig(inputPort, "port", "  *");

const inputMaxClients = document.getElementById("input-max-client");
const btnChangePMaxClients = document.getElementById("input-change-max-client");
      btnChangePMaxClients.onclick = () => changeConfig(inputMaxClients, "max-clients", "[0-9]*");

const inputProtocol = document.getElementById("input-proto");
const btnChangeProtocol = document.getElementById("btn-change-proto");
      btnChangeProtocol.onclick = () => changeConfig(inputProtocol, "proto", "(udp|tcp)");

const inputDns = document.getElementById("input-dns");
const btnChangeDns = document.getElementById("btn-change-dns");
      btnChangeDns.onclick = changeDns;

const selectCompression = document.getElementById("select-compression");
      btnChangeDns.onchange = changeCompression;

const divVpnNotInstalled = document.getElementById('div-not-installed');
const spanVpnNotInstallednformation = document.getElementById('span-not-installed-information');
const btnInstallVpn = document.getElementById('btn-install-vpn');
      btnInstallVpn.onclick = installOpenVPN;

const divSetupingVpn = document.getElementById('div-setuping-vpn');
const setupingVpnOutput = document.getElementById('setuping-output');
const errorOutput = document.getElementById('error_output');



serverConf = "";

function drawDashboard(data) {
    hideNextStepScreen();
    hideExecutingStepScreen();

    execute({
        command: ["cat", "/etc/openvpn/server.conf"],
        stream: (data) => {
            serverConf = data;
            setServiceState();
            getConfig(inputPort, "port ([0-9]*)");
            getConfig(inputProtocol, "proto (udp|tcp)");
            getConfig(inputMaxClients, "max-clients ([0-9]*)");
            getDns();
            getCompression();
        }
    });
    
    showDashboard();    
}

function restartServer() {
    let inputs =  [inputDns, inputMaxClients, inputPort, inputProtocol];

    inputs.forEach(input => {
        input.disabled = true;
        input.value = "...";
    })
    
    execute({
        command: ['systemctl', 'restart', 'openvpn-server@server'],
        next: execute({
            command: ["cat", "/etc/openvpn/server.conf"],
            stream: (data) => {
                serverConf = data;
                setServiceState();
                getConfig(inputPort, "port ([0-9]*)");
                getConfig(inputProtocol, "proto (udp|tcp)");
                getConfig(inputMaxClients, "max-clients ([0-9]*)");
                getDns();
                getCompression();
                inputs.forEach(input => {
                    input.disabled = false;
                })
            }
        })
    });
}

function updateServer() {
    execute({
        script: `echo '${serverConf}' > /etc/openvpn/server.conf`,
        next: restartServer
    });
}

function getCompression() {
    selectCompression.disabled = true;

    let match = serverConf.match(/^;compress (lz4-v2|lz4|lzo)$/m);

    if (match[1] == undefined) {
        selectCompression.value = "null";
    }
    else {
        selectCompression.value = match[1];
    }

    
    selectCompression.disabled = false;
}

function getDns() {
    inputDns.value = "";

    let match = serverConf.match(/^push "dhcp-option DNS \d+\.\d+\.\d+\.\d+"$/gm);

    match.forEach(element => {
        let match = element.match(/push "dhcp-option DNS (\d+\.\d+\.\d+\.\d+)"/);

        inputDns.value += match[1] + ", ";
    });

    inputDns.value = inputDns.value.replace(/, $/g,'');
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

    updateServer();
}

function changeCompression() {
    let script = `sed -i.bak -e '/push "dhcp-option DNS \d+\.\d+\.\d+\.\d+"/d' /etc/openvpn/server.conf\n`;

    if (dns1 != undefined) {
        script += `echo 'push "dhcp-option DNS ${dns1}"' >> /etc/openvpn/server.conf\n`;
    }
    if (dns2 != undefined) {
        script += `echo 'push "dhcp-option DNS ${dns2}"' >> /etc/openvpn/server.conf`;
    }

    execute({
        script: script,
        next: getDns
    });
}

function setServiceState() {
    execute({
        command: ['systemctl', 'show', '-p', 'SubState', '--value', 'openvpn-server@server'],
        stream: (data) => {
            spanServiceStatus.innerHTML = data;
            
            if (data === "running\n") {
                btnToggleServiceState.innerHTML = "Stop";
                btnToggleServiceState.onclick = () => execute({command: ['systemctl', 'stop', 'openvpn-server@server'], next:setServiceState});
            }
            else {
                btnToggleServiceState.innerHTML = "Start";
                btnToggleServiceState.onclick = () => execute({command: ['systemctl', 'start', 'openvpn-server@server'], next:setServiceState});
            } 
        }
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
         directory: "/usr/share/cockpit/pinger" 
    })
    .stream(writeOutput)
    .then(drawDashboard)
    .catch(writeError);
}

function changeConfig(input, config, regex) {
    serverConf = serverConf.replace(new RegExp(`${config} ${regex}`), `${config} ${input.value}`);
    updateServer();
}


function getConfig(input, regex) {
    input.value = serverConf.match(new RegExp(regex))[1];
}

// Não tenho ctz se aqui é o lugar correto para executar as primeiras verificações.
// Não procurei nada sobre OnDocumentLoaded()
cockpit.transport.wait(function() { 
    hideDashboard();
    hideExecutingStepScreen();
    isOpenVpnInstalled();
});

// Utils.js
function hideDashboard() {
    //clientsScreen.style.display = 'none';
    //keysScreen.style.display = 'none';
    //divDashboard.style.display = 'none';
    clientsScreen.style.setProperty("display", "none", "important");
    keysScreen.style.setProperty("display", "none", "important");
    divDashboard.style.setProperty("display", "none", "important");
}
function showDashboard() {
    //divDashboard.style.display = 'block';
    divDashboard.style.setProperty("display", "none", "important");
}
function hideNextStepScreen() {
    //divVpnNotInstalled.style.display = 'none';
    divVpnNotInstalled.style.setProperty("display", "none", "important");
}
function showNextStepScreen() {
    //divVpnNotInstalled.style.display = 'block';
    divVpnNotInstalled.style.setProperty("display", "flex", "important");
}
function showExecutingStepScreen() {
    //divSetupingVpn.style.display = 'block';
    divSetupingVpn.style.setProperty("display", "flex", "important");
}
function hideExecutingStepScreen() {
    //divSetupingVpn.style.display = 'none';
    divSetupingVpn.style.setProperty("display", "none", "important");
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
    if (args.command != undefined) {
        console.log(args.command);
        cockpit.spawn(args.command).stream(args.stream).then(args.next).catch((data) => console.error(data))
    }
    else if (args.script != undefined) {
        console.log(args.script);
        cockpit.script(args.script).stream(args.stream).then(args.next).catch((data) => console.error(data))
    }
}   