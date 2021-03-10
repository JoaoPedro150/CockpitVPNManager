// Documentação do cockpit:
// https://cockpit-project.org/guide/latest/development.html

// Script que a gente vai seguir para o setup da VPN (caso o OpenVPN não estiver instalado):
// https://raw.githubusercontent.com/angristan/openvpn-install/master/openvpn-install.sh

const LATEST_EASYRSA_VERSION = '3.0.8';

const settingsScreen = document.getElementById('settings_screen');
const clientsScreen = document.getElementById('clients_screen');
const keysScreen = document.getElementById('keys_screen');


const buttonSettingsScreen = document.getElementById('settings_screen_btn');    
    buttonSettingsScreen.onclick = () => settingsScreenFn();
const buttonClientsScreen = document.getElementById('clients_screen_btn');
    buttonClientsScreen.onclick = () => clientsScreenFn();
const buttonKeysScreen = document.getElementById('keys_screen_btn');
    buttonKeysScreen.onclick = () => keysScreenFn();

const divDashboard = document.getElementById('div-dashboard');
const spanServiceStatus = document.getElementById('span-service-status');
const btnToggleServiceState = document.getElementById('btn-toggle-service-state');
const btnRestartService = document.getElementById('btn-restart-service')
      btnRestartService.onclick = () => execute({command: ['systemctl', 'restart', 'openvpn-server@server'], next:setServiceState});

const inputPort = document.getElementById("input-port");
const btnChangePort = document.getElementById("btn-change-port");
      //btnChangePort.onclick =  () => changeConfig(btnChangePort, inputPort, "port", "[0-9]*"); aaa

const inputMaxClients = document.getElementById("input-max-client");
const btnChangePMaxClients = document.getElementById("input-change-max-client");
      //btnChangePMaxClients.onclick = () => changeConfig(btnChangePMaxClients, inputMaxClients, "max-clients", "[0-9]*");

const inputProtocol = document.getElementById("input-proto");
const btnChangeProtocol = document.getElementById("btn-change-proto");
      //btnChangeProtocol.onclick = () => changeConfig(btnChangeProtocol, inputProtocol, "proto", "(udp|tcp)");

const inputDns = document.getElementById("input-dns");
const btnChangeDns = document.getElementById("btn-change-dns");
      //btnChangeDns.onclick = changeDns;

const divVpnNotInstalled = document.getElementById('div-not-installed');
const spanVpnNotInstallednformation = document.getElementById('span-not-installed-information');
const btnInstallVpn = document.getElementById('btn-install-vpn');
      btnInstallVpn.onclick = installOpenVPN;

const divSetupingVpn = document.getElementById('div-setuping-vpn');
const setupingVpnOutput = document.getElementById('setuping-output');
const errorOutput = document.getElementById('error_output');



function drawDashboard(data) {
    hideNextStepScreen();
    hideExecutingStepScreen();
    setServiceState();
    getConfig(btnChangePort, inputPort, "port", "[0-9]*");
    getConfig(btnChangeProtocol, inputProtocol, "proto", "udp|tcp");
    getConfig(btnChangePMaxClients, inputMaxClients, "max-clients", "[0-9]*");
    getVpnDns();
    showDashboard();    
}

function getVpnDns() {
    inputDns.value = "Please wait...";
    inputDns.disabled = true;
    btnChangeDns.disabled = true;

    execute({
        script: `grep -E -o '^push "dhcp-option DNS [0-9]\.[0-9]\.[0-9]\.[0-9]"$' /etc/openvpn/server.conf | grep -E -o [0-9]\.[0-9]\.[0-9]\.[0-9]`,
        stream: (data) => {
            inputDns.disabled=false;
            btnChangeDns.disabled = false;
            let dns =  data.split('\n');
            inputDns.value = dns[0] + ((dns[1]?.length > 1) ? ", " + dns[1] : "");
        }
    });
}

function changeDns() {
    let dns = inputDns.value.split(',');
    let dns1 = dns[0]?.trim();
    let dns2 = dns[1]?.trim();

    inputDns.value = "Please wait...";
    inputDns.disabled = true;
    btnChangeDns.disabled = true;

    let script = `sed -i.bak -e '/push "dhcp-option DNS [0-9]\.[0-9]\.[0-9]\.[0-9]"/d' /etc/openvpn/server.conf\n`;

    if (dns1 != undefined) {
        script += `echo 'push "dhcp-option DNS ${dns1}"' >> /etc/openvpn/server.conf\n`;
    }
    if (dns2 != undefined) {
        script += `echo 'push "dhcp-option DNS ${dns2}"' >> /etc/openvpn/server.conf`;
    }

    execute({
        script: script,
        next: getVpnDns
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
                spanVpnNotInstallednformation.innerHTML += ' You need to be logged in as root to install it.';
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

function changeConfig(btn, input, config, regex) {
    let command = ['sed', '-i', '-E', `s/^${config} ${regex}/${config} ${input.value}/g`, '/etc/openvpn/server.conf'];
    input.value = "Please wait...";
    input.disabled = true;
    btn.disabled = true;

    execute({
        command: command,
        next: () => getConfig(btn, input, config, regex)
    });
}


function getConfig(btn, input, config, regex) {
    input.value = "Please wait...";
    input.disabled = true;
    btn.disabled = true;

    execute({
        script: `grep -o -E "${config} ${regex}" /etc/openvpn/server.conf | grep -o -E '${regex}'`,
        stream: (data) => {
            input.value = data;
            input.disabled = false;
            btn.disabled = false;
        }
    });
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
}

function clientsScreenFn(){
    settingsScreen.style.setProperty("display", "none", "important");
    clientsScreen.style.setProperty("display", "block", "important");
    keysScreen.style.setProperty("display", "none", "important");
}

function keysScreenFn(){
    settingsScreen.style.setProperty("display", "none", "important");
    clientsScreen.style.setProperty("display", "none", "important");
    keysScreen.style.setProperty("display", "block", "important");
}


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