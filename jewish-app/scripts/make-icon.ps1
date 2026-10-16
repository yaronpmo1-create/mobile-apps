# יוצר אייקון: מגן דוד זהב על רקע כהה, בכל הגדלים הנדרשים של Android
Add-Type -AssemblyName System.Drawing
$out = Join-Path $PSScriptRoot '..\assets\icons'
New-Item -ItemType Directory -Force $out | Out-Null

function Draw($size, $round) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::Transparent)
  $bg = [System.Drawing.Color]::FromArgb(255, 10, 16, 27)
  $brush = New-Object System.Drawing.SolidBrush $bg
  if ($round) { $g.FillEllipse($brush, 0, 0, $size - 1, $size - 1) }
  else {
    $r = [int]($size * 0.22)
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $p.AddArc(0, 0, 2 * $r, 2 * $r, 180, 90)
    $p.AddArc($size - 2 * $r - 1, 0, 2 * $r, 2 * $r, 270, 90)
    $p.AddArc($size - 2 * $r - 1, $size - 2 * $r - 1, 2 * $r, 2 * $r, 0, 90)
    $p.AddArc(0, $size - 2 * $r - 1, 2 * $r, 2 * $r, 90, 90)
    $p.CloseFigure()
    $g.FillPath($brush, $p)
  }
  $c = $size / 2.0
  $rad = $size * 0.30
  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 232, 194, 106)), ([single]($size * 0.07))
  $pen.LineJoin = 'Round'
  foreach ($start in @(-90, 90)) {
    $pts = @()
    foreach ($k in 0..2) {
      $a = ($start + 120 * $k) * [Math]::PI / 180
      $pts += New-Object System.Drawing.PointF ([single]($c + $rad * [Math]::Cos($a))), ([single]($c + $rad * [Math]::Sin($a)))
    }
    $g.DrawPolygon($pen, [System.Drawing.PointF[]]$pts)
  }
  $g.Dispose()
  return $bmp
}
$sizes = @{ 'mdpi' = 48; 'hdpi' = 72; 'xhdpi' = 96; 'xxhdpi' = 144; 'xxxhdpi' = 192 }
foreach ($k in $sizes.Keys) {
  $d = Join-Path $out ("mipmap-" + $k)
  New-Item -ItemType Directory -Force $d | Out-Null
  $s = $sizes[$k]
  $b = Draw $s $false; $b.Save((Join-Path $d 'ic_launcher.png'), [System.Drawing.Imaging.ImageFormat]::Png); $b.Dispose()
  $b = Draw $s $true; $b.Save((Join-Path $d 'ic_launcher_round.png'), [System.Drawing.Imaging.ImageFormat]::Png); $b.Dispose()
  $b = Draw $s $false; $b.Save((Join-Path $d 'ic_launcher_foreground.png'), [System.Drawing.Imaging.ImageFormat]::Png); $b.Dispose()
}
$b = Draw 512 $false; $b.Save((Join-Path $out 'icon-512.png'), [System.Drawing.Imaging.ImageFormat]::Png); $b.Dispose()
Write-Output 'icons ok'
