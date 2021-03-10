// Documentação do cockpit:
// https://cockpit-project.org/guide/latest/development.html

// Script que a gente vai seguir para o setup da VPN (caso o OpenVPN não estiver instalado):
// https://raw.githubusercontent.com/angristan/openvpn-install/master/openvpn-install.sh

const LATEST_EASYRSA_VERSION = '3.0.8';

const divDashboard = document.getElementById('div-dashboard');
const spanServiceStatus = document.getElementById('span-service-status');
const btnToggleServiceState = document.getElementById('btn-toggle-service-state');
const btnRestartService = document.getElementById('btn-restart-service')
      btnRestartService.onclick = () => execute({command: ['systemctl', 'restart', 'openvpn-server@server'], next:setServiceState});

const inputVpnPort = document.getElementById("input-vpn-port");
const btnChangeVpnPort = document.getElementById("btn-change-vpn-port");
      btnChangeVpnPort.onclick =  () => changeConfig(btnChangeVpnPort, inputVpnPort, "port", "[0-9]*");

const inputVpnProtocol = document.getElementById("input-vpn-proto");
const btnChangeVpnProtocol = document.getElementById("btn-change-vpn-proto");
      btnChangeVpnProtocol.onclick = () => changeConfig(btnChangeVpnProtocol, inputVpnProtocol, "proto", "udp|tcp");

const inputVpnDns = document.getElementById("input-vpn-dns");
const btnChangeVpnDns = document.getElementById("btn-change-vpn-dns");
      btnChangeVpnDns.onclick = changeDns;

const divVpnNotInstalled = document.getElementById('div-vpn-not-installed');
const spanVpnNotInstallednformation = document.getElementById('span-vpn-not-installed-information');
const btnInstallVpn = document.getElementById('btn-install-vpn');
      btnInstallVpn.onclick = installOpenVPN;

const divSetupingVpn = document.getElementById('div-setuping-vpn');
const setupingVpnOutput = document.getElementById('setuping-vpn-output');

function drawDashboard(data) {
    hideNextStepScreen();
    hideExecutingStepScreen();
    setServiceState();
    getVpnConfig(btnChangeVpnPort, inputVpnPort, "port", "[0-9]*");
    getVpnConfig(btnChangeVpnProtocol, inputVpnProtocol, "proto", "udp|tcp");
    getVpnDns();
    showDashboard();    
}

function getVpnDns() {
    inputVpnDns.value = "Please wait...";
    inputVpnDns.disabled = true;
    btnChangeVpnDns.disabled = true;

    execute({
        script: `grep -E -o '^push "dhcp-option DNS [0-9]\.[0-9]\.[0-9]\.[0-9]"$' /etc/openvpn/server.conf | grep -E -o [0-9]\.[0-9]\.[0-9]\.[0-9]`,
        stream: (data) => {
            inputVpnDns.disabled=false;
            btnChangeVpnDns.disabled = false;
            let dns =  data.split('\n');
            console.log(dns);
            inputVpnDns.value = dns[0] + ((dns[1]?.length > 1) ? ", " + dns[1] : "");
        }
    });
}

function changeDns() {
    let dns = inputVpnDns.value.split(',');
    let dns1 = dns[0]?.trim();
    let dns2 = dns[1]?.trim();

    inputVpnDns.value = "Please wait...";
    inputVpnDns.disabled = true;
    btnChangeVpnDns.disabled = true;



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
    let command = ['sed', '-i', '-e', `s/^${config} ${regex}/${config} ${input.value}/g`, '/etc/openvpn/server.conf'];
    input.value = "Please wait...";
    input.disabled = true;
    btn.disabled = true;

    execute({
        command: command,
        next: () => getVpnConfig(btn, input, config, regex)
    });
}


function getVpnConfig(btn, input, config, regex) {
    input.value = "Please wait...";
    input.disabled = true;
    btn.disabled = true;

    execute({
        script: `grep -o -E "${config} ${regex}" /etc/openvpn/server.conf | grep -o -E '${regex}'`,
        stream: (data) => {
            input.value = data;
            input.disabled=false;
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

// Utils.js
function hideDashboard() {
    divDashboard.style.display = 'none';
}
function showDashboard() {
    divDashboard.style.display = 'block';
}
function hideNextStepScreen() {
    divVpnNotInstalled.style.display = 'none';
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
    if (args.command != undefined) {
        console.log(args.command);
        cockpit.spawn(args.command).stream(args.stream).then(args.next).catch((data) => console.error(data))
    }
    else if (args.script != undefined) {
        console.log(args.script);
        cockpit.script(args.script).stream(args.stream).then(args.next).catch((data) => console.error(data))
    }
}   