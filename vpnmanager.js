// Documentação do cockpit:
// https://cockpit-project.org/guide/latest/development.html

// Script que a gente vai seguir para o setup da VPN (caso o OpenVPN não estiver instalado):
// https://raw.githubusercontent.com/angristan/openvpn-install/master/openvpn-install.sh

const nextSetpMessage = document.getElementById("nextStepMessage");
const btnNextStep = document.getElementById("btnNextStep");
const nextStepScreen = document.getElementById("next-step");
const output = document.getElementById("output");
const errorOutput = document.getElementById("errorOutput");
const infoMessage = document.getElementById("infoMessage");
const executingStepScreen = document.getElementById("executing-step");

function drawDashboard(data) {

}

function isOpenVpnInstalled() {
    cockpit.spawn(["test", "-e", "/etc/openvpn/server.conf"])
        .then(drawDashboard)
        .catch(installOpenVpnMessage); 
}

function installOpenVpnMessage(data) {
    hideExecutingStepScreen();

    function buildMessage(user) {
        let message = "It looks like you don't have OpenVPN installed yet.";

        if (user.id != 0) {
            message += " You need to be logged in as root to install it.";
        }
        else {
            btnNextStep.onclick = installVpnServer;
            btnNextStep.innerHTML = "Install OpenVPN";
        }

        nextSetpMessage.innerHTML = message; 
    }
    
    cockpit.user().then(buildMessage);
}

function installVpnServer() {
    hideNextStepScreen();
    showExecutingStepScreen();
    infoMessage.innerHTML = "Installing OpenVPN";

    function install(package, next) {
        infoMessage.innerHTML = "trying nstalling " + package + "...";
        clearOutput();

        cockpit.spawn(["yum", "install", "-y", package])
        .stream(writeOutput)
        .then(next)
        .catch(writeError); 
    }

    function intallLastestEasyRsaVersion(data) {

    }

    // An old version of easy-rsa was available by default in some openvpn packages
    function removeEasyRsaOldVersion(data) {
        infoMessage.innerHTML = "Removing easy-rsa old version.";
        clearOutput();

        cockpit.spawn(["rm", "-rf", "/etc/openvpn/easy-rsa/"])
            .stream(writeOutput)
            .then(intallLastestEasyRsaVersion)
            .catch(writeError); 
    }

    installPolicycoreutilsPython = (data) => install("policycoreutils-python*", removeEasyRsaOldVersion);
    installTar = (data) => install("tar", installPolicycoreutilsPython);
    installCurl = (data) => install("curl", installTar);
    installCaCertificates = (data) => install("ca-certificates", installCurl);
    installWget = (data) => install("wget", installCaCertificates);
    installOpenssl = (data) => install("openssl", installWget);
    installIptables = (data) => install("iptables", installOpenssl);
    installOpenVPN = (data) => install("openvpn", installIptables);
    install("epel-release", installOpenVPN);

    // Ainda terá mais passos
}


function hideNextStepScreen() {
    nextStepScreen.style.display = "none";
}

function showExecutingStepScreen() {
    executingStepScreen.style.display = "block";
}

function hideExecutingStepScreen() {
    executingStepScreen.style.display = "none";
}

function clearOutput() {
    output.innerHTML = "";
}

function writeOutput(data) {
    output.append(document.createTextNode(data));
}

function writeError(data) {
    errorOutput.style.color = "red";
    errorOutput.append(document.createTextNode(data));
}

// Não tenho ctz se aqui é o lugar correto para executar as primeiras verificações.
// Não procurei nada sobre OnDocumentLoaded()
cockpit.transport.wait(function() { 
    isOpenVpnInstalled();
});
