package net.millida.launcher.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import net.millida.launcher.R

/** The KonMin mark (KonMinli), the same sign as the KonMin desktop launcher's. */
@Composable
fun BrandSign(size: Dp, modifier: Modifier = Modifier) {
    Image(painterResource(R.drawable.ic_brand_logo), contentDescription = "KonMin", modifier = modifier.size(size))
}

private val WordmarkFont = FontFamily(Font(R.font.unbounded_medium, FontWeight.Medium))

/**
 * Sign plus the KonMin wordmark: Unbounded 500, upper case, tracking 0.02em, text 22 to a 36 sign
 * with a 12 gap (the proportions of the upstream lockup). No ® sign: KonMin is not a registered mark.
 */
@Composable
fun BrandLockup(signSize: Dp = 22.dp, color: Color = millida.fg, modifier: Modifier = Modifier) {
    val fontSize = signSize.value * 22f / 36f
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        BrandSign(signSize)
        Spacer(Modifier.width(signSize * (12f / 36f)))
        androidx.compose.material3.Text(
            buildAnnotatedString { append("KONMIN") },
            style = TextStyle(
                fontFamily = WordmarkFont,
                fontWeight = FontWeight.Medium,
                fontSize = fontSize.sp,
                lineHeight = fontSize.sp,
                letterSpacing = (fontSize * 0.02f).sp,
            ),
            color = color,
            maxLines = 1,
        )
    }
}
