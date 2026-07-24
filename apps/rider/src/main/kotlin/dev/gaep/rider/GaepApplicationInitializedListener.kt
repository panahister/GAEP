package dev.gaep.rider

import com.intellij.ide.ApplicationInitializedListener
import com.intellij.openapi.diagnostic.Logger

class GaepApplicationInitializedListener : ApplicationInitializedListener {
    override suspend fun execute() {
        LOG.info(ACTIVATION_MARKER)
    }

    companion object {
        const val ACTIVATION_MARKER =
            "GAEP_NATIVE_PLUGIN_ACTIVATED id=dev.gaep.productstudio version=0.1.0 boundary=no-provider-no-write-authority"

        private val LOG = Logger.getInstance(GaepApplicationInitializedListener::class.java)
    }
}
