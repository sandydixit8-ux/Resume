Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$form = New-Object System.Windows.Forms.Form
$form.Text = "Keyboard Test - O aur L"
$form.Size = New-Object System.Drawing.Size(450,300)
$form.StartPosition = "CenterScreen"

$label = New-Object System.Windows.Forms.Label
$label.Text = "Neeche box me 'o' aur 'l' type karke check karo:`nDono type ho rahe hain toh key sahi hai, nahi toh problem hai."
$label.Location = New-Object System.Drawing.Point(10,10)
$label.Size = New-Object System.Drawing.Size(420,50)

$textbox = New-Object System.Windows.Forms.TextBox
$textbox.Location = New-Object System.Drawing.Point(10,70)
$textbox.Size = New-Object System.Drawing.Size(410,100)
$textbox.Multiline = $true
$textbox.Font = New-Object System.Drawing.Font("Consolas", 14)

$btn = New-Object System.Windows.Forms.Button
$btn.Text = "Done"
$btn.Location = New-Object System.Drawing.Point(160,190)
$btn.Size = New-Object System.Drawing.Size(100,40)

$btn.Add_Click({
    $script:result = $textbox.Text
    $form.Close()
})

$form.Controls.Add($label)
$form.Controls.Add($textbox)
$form.Controls.Add($btn)

$form.ShowDialog() | Out-Null

if ([string]::IsNullOrEmpty($script:result)) {
    Write-Output "Kuch type nahi hua - key kaam nahi kar rahi hain!"
} else {
    Write-Output "Aapne type kiya: $($script:result)"
    if ($script:result -match 'o' -and $script:result -match 'l') {
        Write-Output "Dono keys (o aur l) WORKING hain!"
    } else {
        Write-Output "Kuch key missing hai - problem hai!"
    }
}
