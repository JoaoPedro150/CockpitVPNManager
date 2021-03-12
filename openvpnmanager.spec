Name:           openvpnmanager
Version:        1.0.0
Release:        1
Summary:        A OpenVpn manager plugin for cockpit on CentOS.

Group:          Productivity/Networking/Security
License:        LGPL
URL:            https://github.com/JoaoPedro150/CockpitVPNManager
%undefine _disable_source_fetch
Source:         https://github.com/JoaoPedro150/CockpitVPNManager/blob/main/cockpitvpnmanager.tar.gz

Requires:       bash    cockpit >= 224.2

%description
A OpenVpn manager plugin for cockpit on CentOS.

%prep
%setup -q -n %{name}-%{version}

%build

%install
rm -rf ~/.local/share/cockpit/CockpitVPNManager
mkdir -p ~/.local/share/cockpit/CockpitVPNManager
cp CockpitVPNManager/* ~/.local/share/cockpit/cockpit/CockpitVPNManager/

%clean


%files
~/.local/share/cockpit/CockpitVPNManager


%changelog
