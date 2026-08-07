$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies 'System.Drawing.dll' -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;

public static class PortraitAtlasBuilder {
    public static void Rebuild(string input, string output, int columns, int rows, int inset, int yLift, int topTrim) {
        Bitmap loaded = new Bitmap(input);
        Bitmap source = new Bitmap(loaded);
        Bitmap atlas = new Bitmap(columns * 256, rows * 256, PixelFormat.Format32bppArgb);
        loaded.Dispose();
        try {
            for (int row = 0; row < rows; row++) for (int column = 0; column < columns; column++) {
                int left = (int)Math.Round(column * source.Width / (double)columns) + inset;
                int top = (int)Math.Round(row * source.Height / (double)rows) + inset + topTrim;
                int right = (int)Math.Round((column + 1) * source.Width / (double)columns) - inset;
                int bottom = (int)Math.Round((row + 1) * source.Height / (double)rows) - inset;
                Bitmap cell = source.Clone(new Rectangle(left, top, right - left, bottom - top), PixelFormat.Format32bppArgb);
                try {
                    int minX = cell.Width, minY = cell.Height, maxX = -1, maxY = -1;
                    for (int y = 0; y < cell.Height; y++) for (int x = 0; x < cell.Width; x++) {
                        if (cell.GetPixel(x, y).A <= 8) continue;
                        minX = Math.Min(minX, x); minY = Math.Min(minY, y);
                        maxX = Math.Max(maxX, x); maxY = Math.Max(maxY, y);
                    }
                    if (maxX < minX) continue;

                    Bitmap isolated = new Bitmap(maxX - minX + 5, maxY - minY + 5, PixelFormat.Format32bppArgb);
                    try {
                        using (Graphics copy = Graphics.FromImage(isolated)) copy.DrawImageUnscaled(cell, 2 - minX, 2 - minY);
                        double scale = Math.Min(248.0 / isolated.Width, (248.0 - yLift) / isolated.Height);
                        int width = Math.Max(1, (int)Math.Round(isolated.Width * scale));
                        int height = Math.Max(1, (int)Math.Round(isolated.Height * scale));
                        int xOffset = column * 256 + (256 - width) / 2;
                        int yOffset = row * 256 + 252 - height - yLift;
                        using (Graphics graphics = Graphics.FromImage(atlas)) {
                            graphics.CompositingMode = CompositingMode.SourceCopy;
                            graphics.CompositingQuality = CompositingQuality.GammaCorrected;
                            graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
                            graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
                            graphics.DrawImage(isolated, new Rectangle(xOffset, yOffset, width, height), 0, 0, isolated.Width, isolated.Height, GraphicsUnit.Pixel);
                        }
                    } finally { isolated.Dispose(); }
                } finally { cell.Dispose(); }
            }

            string temporary = output + ".tmp.png";
            atlas.Save(temporary, ImageFormat.Png);
            File.Copy(temporary, output, true);
            File.Delete(temporary);
            using (Bitmap check = new Bitmap(output)) {
                if (check.Width != columns * 256 || check.Height != rows * 256)
                    throw new InvalidDataException("Invalid atlas size: " + output);
                for (int column = 1; column < columns; column++)
                    for (int y = 0; y < check.Height; y++)
                        for (int x = column * 256 - 2; x < column * 256 + 2; x++)
                            if (check.GetPixel(x, y).A > 8) throw new InvalidDataException("Portrait crosses a column boundary: " + output);
                for (int row = 1; row < rows; row++)
                    for (int x = 0; x < check.Width; x++)
                        for (int y = row * 256 - 2; y < row * 256 + 2; y++)
                            if (check.GetPixel(x, y).A > 8) throw new InvalidDataException("Portrait crosses a row boundary: " + output);
            }
        } finally { atlas.Dispose(); source.Dispose(); }
    }
}
'@

$root = $PSScriptRoot
$textures = Join-Path $root 'dialogue-resource-pack\assets\dialog\textures\font'
[PortraitAtlasBuilder]::Rebuild((Join-Path $root 'dialogue-generated-assets\rpg-expression-sheet-transparent.png'), (Join-Path $textures 'rpg_expressions.png'), 5, 6, 8, 0, 0)
[PortraitAtlasBuilder]::Rebuild((Join-Path $root 'dialogue-generated-assets\rpg-expression-sheet-2-transparent.png'), (Join-Path $textures 'rpg_expressions_2.png'), 5, 6, 8, 0, 0)
[PortraitAtlasBuilder]::Rebuild((Join-Path $root 'dialogue-generated-assets\village_characters-regenerated-alpha.png'), (Join-Path $textures 'village_characters.png'), 5, 6, 4, 20, 12)
[PortraitAtlasBuilder]::Rebuild((Join-Path $root 'dialogue-generated-assets\atlas-sources\village_neutral.png'), (Join-Path $textures 'village_neutral.png'), 3, 2, 4, 0, 0)
[PortraitAtlasBuilder]::Rebuild((Join-Path $root 'dialogue-generated-assets\atlas-sources\neutral_monsters.png'), (Join-Path $textures 'neutral_monsters.png'), 4, 4, 4, 0, 0)
