# Copyright (C) 2022 -  Juergen Zimmermann, Hochschule Karlsruhe
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

# https://docs.microsoft.com/en-us/powershell/scripting/developer/cmdlet/approved-verbs-for-windows-powershell-commands?view=powershell-7

# Aufruf:   .\fortio.ps1

Set-StrictMode -Version Latest

$versionMinimum = [Version]'7.4.0'
$versionCurrent = $PSVersionTable.PSVersion
if ($versionMinimum -gt $versionCurrent) {
  throw "PowerShell $versionMinimum statt $versionCurrent erforderlich"
}

# Titel setzen
$host.ui.RawUI.WindowTitle = 'fortio'

# https://github.com/fortio/fortio
Write-Output 'Webbrowser mit http://localhost:8088/fortio aufrufen'
Write-Output '    URL:                       https://localhost:3000/rest/1'
Write-Output '    QPS (queries per second):  50'
Write-Output '    Duration:                  10s'
Write-Output '    Timeout:                   750s'
Write-Output '    https insecure:            Haken setzen'

C:\Zimmermann\fortio\fortio server -h2 -http-port 8088
# Kubernetes:
#C:\Zimmermann\fortio\fortio server -http-port 8088
