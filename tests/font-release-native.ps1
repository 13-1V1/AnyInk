# Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
# brennanmmeyer@gmail.com
param([Parameter(Mandatory=$true)][string]$Manifest)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
// Created by: Brennan Meyer with use of Codex 09/24/2026 Santa Clarita, CA
// brennanmmeyer@gmail.com
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Text;
public static class FontReleaseGdi {
 [DllImport("gdi32.dll",CharSet=CharSet.Unicode)] public static extern int AddFontResourceEx(string path,uint flags,IntPtr reserved);
 [DllImport("gdi32.dll",CharSet=CharSet.Unicode)] public static extern bool RemoveFontResourceEx(string path,uint flags,IntPtr reserved);
 [DllImport("gdi32.dll",CharSet=CharSet.Unicode)] static extern IntPtr CreateFont(int h,int w,int e,int o,int weight,uint italic,uint underline,uint strike,uint charset,uint output,uint clip,uint quality,uint pitch,string face);
 [DllImport("gdi32.dll")] static extern IntPtr SelectObject(IntPtr dc,IntPtr obj);
 [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr obj);
 [DllImport("gdi32.dll",CharSet=CharSet.Unicode)] static extern int GetTextFace(IntPtr dc,int count,StringBuilder face);
 [DllImport("gdi32.dll",CharSet=CharSet.Unicode)] static extern uint GetGlyphIndices(IntPtr dc,string text,int count,ushort[] indices,uint flags);
 [DllImport("gdi32.dll",CharSet=CharSet.Unicode)] static extern bool GetTextExtentPoint32(IntPtr dc,string text,int count,out Size size);
 [DllImport("gdi32.dll")] static extern uint SetTextAlign(IntPtr dc,uint align);
 [DllImport("gdi32.dll")] static extern uint SetTextColor(IntPtr dc,uint color);
 [DllImport("gdi32.dll")] static extern uint SetBkColor(IntPtr dc,uint color);
 [DllImport("gdi32.dll",CharSet=CharSet.Unicode)] static extern bool TextOut(IntPtr dc,int x,int y,string text,int count);
 public static int Render(string family,string text,string output) {
  using(var bitmap=new Bitmap(2600,270,PixelFormat.Format32bppArgb))
  using(var graphics=Graphics.FromImage(bitmap)) {
   graphics.Clear(Color.White);
   IntPtr dc=graphics.GetHdc(),font=IntPtr.Zero,previous=IntPtr.Zero;
   int width=0;
   try {
    font=CreateFont(-200,0,0,0,400,0,0,0,1,0,0,4,0,family);
    if(font==IntPtr.Zero) throw new Exception("CreateFont failed");
    previous=SelectObject(dc,font);
    var face=new StringBuilder(128);
    if(GetTextFace(dc,128,face)==0 || face.ToString()!=family) throw new Exception("Font fallback: "+face);
    var indices=new ushort[text.Length];
    if(GetGlyphIndices(dc,text,text.Length,indices,1)==0xffffffff) throw new Exception("GetGlyphIndices failed");
    foreach(var index in indices) if(index==0xffff || index==0) throw new Exception("Missing glyph");
    Size size;
    if(!GetTextExtentPoint32(dc,text,text.Length,out size)) throw new Exception("Measurement failed");
    width=size.Width;
    SetTextAlign(dc,24); // TA_BASELINE | TA_LEFT
    SetTextColor(dc,0); SetBkColor(dc,0xffffff);
    if(!TextOut(dc,20,210,text,text.Length)) throw new Exception("TextOut failed");
   } finally {
    if(previous!=IntPtr.Zero) SelectObject(dc,previous);
    if(font!=IntPtr.Zero) DeleteObject(font);
    graphics.ReleaseHdc(dc);
   }
   bitmap.Save(output,ImageFormat.Png);
   return width;
  }
 }
}
'@
$spec = Get-Content -LiteralPath $Manifest -Raw | ConvertFrom-Json
$directory = Split-Path -Parent $Manifest
$hasher = [System.Security.Cryptography.SHA256]::Create()
try {
 $actualHash = [BitConverter]::ToString($hasher.ComputeHash([IO.File]::ReadAllBytes($spec.fontPath))).Replace('-','').ToLowerInvariant()
} finally { $hasher.Dispose() }
if ($actualHash -ne $spec.sha256) {
 throw 'OTF hash differs from the exporter manifest.'
}
$added = [FontReleaseGdi]::AddFontResourceEx($spec.fontPath,16,[IntPtr]::Zero)
if ($added -lt 1) { throw 'Windows rejected the OTF (AddFontResourceEx returned 0).' }
$report = [ordered]@{ windows=[Environment]::OSVersion.VersionString; family=$spec.family; sha256=$spec.sha256; added=$added; glyphs=@(); removed=$false }
try {
 foreach ($probe in $spec.probes) {
  $png = Join-Path $directory ($probe.character + '.png')
  $width = [FontReleaseGdi]::Render($spec.family,$probe.character,$png)
  if ($width -ne 200) { throw "Unexpected advance for $($probe.character): $width" }
  $bitmap = [System.Drawing.Bitmap]::FromFile($png)
  try {
   $inkCount = 0
   for ($y=0; $y -lt $bitmap.Height; $y++) {
    for ($x=0; $x -lt 240; $x++) { if ($bitmap.GetPixel($x,$y).R -lt 128) { $inkCount++ } }
   }
   if ($inkCount -eq 0) { throw "Empty render: $($probe.character)" }
   foreach ($point in $probe.points) {
    $x = [int][Math]::Round(20 + $point.x * 0.2)
    $y = [int][Math]::Round(210 - $point.y * 0.2)
    $red = $bitmap.GetPixel($x,$y).R
    if (($point.ink -and $red -gt 32) -or (!$point.ink -and $red -lt 223)) {
     throw "Wrong ink/paper at $($probe.character) ($x,$y): $red"
    }
   }
   $report.glyphs += @{character=$probe.character; advancePixels=$width; inkPixels=$inkCount; probes=$probe.points.Count}
  } finally { $bitmap.Dispose() }
 }
 $report.text = 'ABCDEF ABCDEF'
 $report.textAdvancePixels = [FontReleaseGdi]::Render($spec.family,$report.text,(Join-Path $directory 'text.png'))
 if ($report.textAdvancePixels -ne 2450) { throw "Wrong text advance: $($report.textAdvancePixels)" }
} finally {
 $report.removed = [FontReleaseGdi]::RemoveFontResourceEx($spec.fontPath,16,[IntPtr]::Zero)
 $report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $directory 'native-results.json') -Encoding UTF8
}
if (!$report.removed) { throw 'RemoveFontResourceEx failed.' }
$report | ConvertTo-Json -Depth 8
