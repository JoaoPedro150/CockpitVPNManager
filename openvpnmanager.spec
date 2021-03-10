Name:           openvpnmanager
Version:        1.0.0
Release:        1
Summary:        A OpenVpn manager plugin for cockpit on CentOS.

Group:          Productivity/Networking/Security
License:        LGPL
URL:            https://github.com/JoaoPedro150/CockpitVPNManager
%undefine _disable_source_fetch
Source0:        https://github.com/JoaoPedro150/CockpitVPNManager/v1.0.0-openvpnmanager.tar.gz

Requires:       bash    cockpit >= 224.2

%description
A OpenVpn manager plugin for cockpit on CentOS.

%prep
%setup -q

%build

%install
rm -rf ~/.local/share/cockpit/CockpitVPNManager
mkdir -p ~/.local/share/cockpit/CockpitVPNManager
cp CockpitVPNManager/* ~/.local/share/cockpit/cockpit/CockpitVPNManager/

%clean


%files
~/.local/share/cockpit/CockpitVPNManager


%changelog

~